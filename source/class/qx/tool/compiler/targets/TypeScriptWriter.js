/* ************************************************************************
 *
 *    qooxdoo-compiler - node.js based replacement for the Qooxdoo python
 *    toolchain
 *
 *    https://github.com/qooxdoo/qooxdoo
 *
 *    Copyright:
 *      2011-2017 Zenesis Limited, http://www.zenesis.com
 *
 *    License:
 *      MIT: https://opensource.org/licenses/MIT
 *
 *      This software is provided under the same licensing terms as Qooxdoo,
 *      please see the LICENSE file in the Qooxdoo project's top-level directory
 *      for details.
 *
 *    Authors:
 *      * JBaron (Peter, @jbaron)
 *      * John Spackman (john.spackman@zenesis.com, @johnspackman)
 *
 * *********************************************************************** */

var path = require("path");

var fs = require("fs");
const { promisify } = require("util");
const readFile = promisify(fs.readFile);

/**
 * Generates TypeScript .d.ts files
 */
qx.Class.define("qx.tool.compiler.targets.TypeScriptWriter", {
  extend: qx.core.Object,

  /**
   *
   * @param {qx.tool.compiler.targets.MetaDatabase} metaDb loaded database
   */
  construct(metaDb) {
    super();
    this.__metaDb = metaDb;
  },

  properties: {
    outputTo: {
      init: "qooxdoo.d.ts",
      check: "String"
    }
  },

  members: {
    /** @type {qx.tool.compiler.MetaDatabase} */
    __metaDb: null,

    /** @type {Stream} where to write the .d.ts */
    __outputStream: null,

    __outputStreamClosed: null,

    /** @type {qx.tool.compiler.MetaExtraction} */
    __currentClass: null,

    /** @type {object} */
    __hierarchy: null,

    /** Current indent */
    __indent: "    ",

    /**
     * Opens the stream to write to
     */
    async open() {
      var time = new Date();
      this.__outputStream = fs.createWriteStream(this.getOutputTo());
      this.__outputStreamClosed = new qx.Promise();
      this.__outputStream.on("close", () =>
        this.__outputStreamClosed.resolve()
      );

      this.write(`// Generated declaration file at ${time}\n`);

      let str = qx.util.ResourceManager.getInstance().toUri(
        "qx/tool/cli/templates/TypeScriptWriter-base_declaration.d.ts"
      );

      let baseDeclaration = await fs.promises.readFile(str, "utf8");
      this.write(baseDeclaration + "\n");
    },

    /**
     * Closes the stream
     */
    async close() {
      this.write("}\n");
      await this.__outputStream.end();
      this.__outputStream = null;
      await this.__outputStreamClosed;
      this.__outputStreamClosed = null;
    },

    /**
     * Processes a list of filename and generates the .d.ts
     *
     */
    async process() {
      await this.open();
      let classnames = this.__metaDb.getClassnames();
      classnames.sort();
      let lastPackageName = null;
      let declared = false;
      for (let classname of classnames) {
        let metaData = this.__metaDb.getMetaData(classname);
        var pos = classname.lastIndexOf(".");
        var packageName = "";
        if (pos > -1) {
          packageName = classname.substring(0, pos);
        }
        if (lastPackageName != packageName) {
          if (lastPackageName) {
            this.write("}\n\n");
          }
          if (packageName) {
            this.write("declare module " + packageName + " {\n");
            declared = true;
          } else {
            declared = false;
          }
          lastPackageName = packageName;
        } else {
          this.write("\n");
        }
        await this.writeClass(metaData, declared);
      }
      await this.close();
    },

    /**
     * Write a piece of code to the declaration file
     */
    write(msg) {
      this.__outputStream.write(msg);
    },

    /**
     * Write the class or interface declaration
     */
    async writeClass(meta, declared) {
      if (!meta.className) {
        return;
      }

      this.__currentClass = meta;
      this.__hierarchy = this.__metaDb.getHierarchyFlat(meta);
      // qx.tool.compiler.Console.info("Processing class " + meta.packageName + "." + meta.name);
      var extendsClause = "";
      if (
        meta.superClass &&
        meta.superClass !== "Object" &&
        meta.superClass !== "Array" &&
        meta.superClass !== "Error"
      ) {
        if (meta.type === "interface" && Array.isArray(meta.superClass)) {
          let superTypes = meta.superClass.map(sup => this.getType(sup));
          superTypes.filter(sup => sup != "any");
          if (superTypes.length) {
            extendsClause = " extends " + superTypes.join(", ");
          }
        } else {
          let superType = this.getType(meta.superClass);
          if (superType != "any") {
            extendsClause = " extends " + superType;
          }
        }
      }
      var type = "class "; // default for class and mixins
      if (meta.type === "interface") {
        type = "interface ";
      } else if (meta.abstract) {
        type = "abstract " + type;
      }
      if (!declared) {
        type = "declare " + type;
      }

      this.write("  // " + meta.className + "\n");
      let name = meta.className;
      let pos = name.lastIndexOf(".");
      if (pos > -1) {
        name = name.substring(pos + 1);
      }
      this.write("  " + type + name + extendsClause);

      if (meta.interfaces && meta.interfaces.length) {
        this.write(
          " implements " +
            meta.interfaces.map(itf => this.getType(itf)).join(", ")
        );
      }

      this.write(" {\n");

      if (meta.type == "class" && meta.construct) {
        this.writeConstructor(meta.construct);
      }

      this.writeClassBody(meta);

      this.write("\n  }\n");
      this.__currentClass = null;
      this.__hierarchy = null;
    },

    /**
     * Checks whether a class member is an override or not.
     * @param {string} name - the name of the class member
     * @param {"statics"|"members"|"properties"|"events"} kind - the kind of the class member
     * @returns {boolean} `true` if the member is an override, `false` if it is not
     */
    checkOverride(name, kind) {
      for (const superclass in this.__hierarchy.superClasses) {
        const items = this.__hierarchy.superClasses[superclass][kind];
        if (items && name in items) {
          return true;
        }
      }

      // if the member exist on a mixin of this class directly, it is NOT an override (this prevents mixin inclusions overriding themselves)
      for (const localMixin of this.__currentClass.mixins ?? []) {
        const items = this.__hierarchy.mixins[localMixin][kind];
        if (items && name in items) {
          return false;
        }
      }

      for (const mixin in this.__hierarchy.mixins) {
        const items = this.__hierarchy.mixins[mixin][kind];
        if (items && name in items) {
          return true;
        }
      }
      return false;
    },

    /**
     * Include the members, statics, properties of all mixins, if any.
     */
    includeMixins(meta) {
      const mixins = meta.mixins
        ? Array.isArray(meta.mixins)
          ? meta.mixins
          : [meta.mixins]
        : [];

      for (const mixin of mixins) {
        // recurse: mixins can include mixins
        this.write(this.__indent + `// Mixin: ${mixin}\n`);
        if (!this.__hierarchy.mixins[mixin]) debugger;
        this.writeClassBody(this.__hierarchy.mixins[mixin]);
      }
    },

    /**
     * Writes the body of the class (excl. constructor) and processes mixins
     */
    writeClassBody(meta) {
      if (meta.isSingleton) {
        this.writeMethods(
          {
            getInstance: {
              type: "function",
              access: "public",
              jsdoc: {
                "@return": [{ type: meta.className }]
              }
            }
          },

          meta,
          true
        );
      }
      this.writeMethods(meta.statics, meta, true);
      this.writeMethods(meta.members, meta);
      if (meta.properties) {
        this.writeProperties(meta);
      }
      this.includeMixins(meta);
    },

    /**
     * Writes the property accessors
     */
    writeProperties(meta) {
      for (let propertyName in meta.properties) {
        if (this.checkOverride(propertyName, "properties")) {
          continue;
        }
        let propertyMeta = meta.properties[propertyName];
        let upname = qx.lang.String.firstUp(propertyName);
        let type = propertyMeta.check || "any";
        if (!propertyMeta.group) {
          this.__writeMethod("get" + upname, {
            returnType: type,
            description: `Gets the ${propertyName} property`
          });

          if (type == "Boolean") {
            this.__writeMethod("is" + upname, {
              returnType: type,
              description: `Gets the ${propertyName} property`
            });
          }
        }
        this.__writeMethod("set" + upname, {
          params: [{ name: "value", type }],
          description: `Sets the ${propertyName} property`
        });

        this.__writeMethod("reset" + upname, {
          description: `Resets the ${propertyName} property`
        });

        if (propertyMeta.async) {
          this.__writeMethod("get" + upname + "Async", {
            returnType: type,
            description: `Gets the ${propertyName} property, asynchronously`
          });

          if (type == "Boolean") {
            this.__writeMethod("is" + upname + "Async", {
              returnType: type,
              description: `Gets the ${propertyName} property, asynchronously`
            });
          }
          this.__writeMethod("set" + upname + "Async", {
            params: [{ name: "value", type }],
            description: `Sets the ${propertyName} property`
          });
        }
      }
    },

    /**
     * Do the mapping of types from Qooxdoo to TypeScript
     *
     * @param {String} typename the name of the type to convert
     * @return {String} the Typescript name, if possible
     */
    getType(typename) {
      // TODO: use an AST parser to handle modifying complex type expressions

      // handle certain cases
      var defaultType = "any";
      if (!typename || typename == "[[ Function ]]") {
        return defaultType;
      }
      if (typeof typename == "object") {
        typename = typename.name;
      }

      // handle transformations

      if (typename === "Array") {
        return "any[]";
      }

      //mapping
      const fromTypes = Object.keys(
        qx.tool.compiler.targets.TypeScriptWriter.TYPE_MAPPINGS
      );

      const delimiter = "[^.a-zA-Z0-9]";
      const re = new RegExp(
        `(^|[^.a-zA-Z0-9])(${fromTypes
          .join("|")
          .replace("*", "\\*")})($|[^.a-zA-Z0-9<])`
      );

      // regexp matches overlapping strings, so we need to loop
      while (typename.match(re)) {
        typename = typename.replace(
          re,
          (match, p1, p2, p3) =>
            `${p1}${qx.tool.compiler.targets.TypeScriptWriter.TYPE_MAPPINGS[p2]}${p3}`
        );
      }

      //nullables
      typename = typename.replace(/\?.*$/, "");

      // handle global types
      if (
        (this.__metaDb.getMetaData(typename) && typename.indexOf(".") != -1) ||
        (this.__metaDb.getMetaData(typename.replace(/\[\]/g, "")) &&
          typename.replace(/\[\]/g, "").indexOf(".") != -1)
      ) {
        return "globalThis." + typename;
      }

      typename = typename.replace("Promise<", "globalThis.Promise<");
      typename = typename.replace(
        /(^|[^.a-zA-Z])(var|\*)([^.a-zA-Z]|$)/g,
        "$1unknown$3"
      );

      // this will do for now, but it will fail on an expression like `Array<Record<string, any>>`
      typename = typename.replace(/(?<!qx\.data\.)Array<([^>]+)>/g, "($1)[]");

      // We don't know the type
      // qx.tool.compiler.Console.error("Unknown type: " + typename);
      return typename;
    },

    /**
     * Write a constructor
     */
    writeConstructor(methodMeta) {
      this.write(
        this.__indent +
          "constructor (" +
          this.__serializeParameters(methodMeta.params) +
          ");\n"
      );
    },

    /**
     * @typedef {Object} MethodMeta
     * @property {Boolean} access
     * @property {Boolean} abstract
     * @property {Boolean} async
     * @property {Boolean} static
     * @property {Boolean} mixin
     * @property {Array} parameters JSDoc parameters and types
     * @property {any} returnType JSDoc return type
     * @property {object} jsdoc
     * @property {Boolean} hideMethod
     *
     * @param {String} methodName
     * @param {MethodMeta} config
     */
    __writeMethod(methodName, config) {
      var declaration = "";
      var comment = "";

      if (config.access === "protected" || config.access === "public") {
        declaration += config.access + " ";
      } else if (config.access === "private") {
        return;
      }

      if (config.static) {
        declaration += "static ";
      }

      if (config.abstract) {
        declaration += "abstract ";
        comment += "Abstract ";
      }

      if (config.mixin) {
        comment += "Mixin ";
      }

      declaration += this.__escapeMethodName(methodName) + "(";

      if (config.parameters) {
        declaration += this.__serializeParameters(config.parameters);
      }
      declaration += ")";

      var returnType = "void";
      if (config.returnType) {
        returnType = this.getType(config.returnType.type);
      }
      declaration += ": " + returnType;

      if (comment) {
        comment = " // " + comment;
      }

      if (config.jsdoc) {
        const content = [];

        const fixup = source =>
          source
            .replace(/<\/?p>/g, "")
            .replace(
              /\{@link #([^}]+)\}/g,
              `{@link ${this.__currentClass.className}.$1}`
            )
            .replace(
              /<pre(\sclass=.(.+).)>(<code>)?((.|\n)*?)(<\/code>)?<\/pre>/,
              "```$2$4```"
            )
            .replace(/<code>(.*?)<\/code>/, "`$1`");

        const description = config.jsdoc?.["@description"]?.[0]?.body;
        if (description) {
          content.push(...fixup(description).split("\n"));
        }
        const sourcePath = path.relative(
          path.dirname(this.getOutputTo()),
          path.join(
            process.cwd(),
            this.__metaDb.getRootDir(),
            this.__currentClass.classFilename
          )
        );

        this.write(
          [
            `/**`,
            ...content.map(c => ` * ${c.trim()}`),
            ` *`,
            ` * [source code](${sourcePath})`,
            ` */\n`
          ]
            .map(line => this.__indent + line)
            .join("\n")
        );
      }

      this.write(
        this.__indent +
          (config.hideMethod ? "// " : "") +
          declaration +
          ";" +
          comment +
          "\n"
      );
    },

    __serializeParameters(params) {
      let forceOptional = false;
      let arr = params.map(paramMeta => {
        var decl = paramMeta.name;
        let optional = paramMeta.optional;
        if (paramMeta.name == "varargs") {
          optional = true;
        }
        if (optional || forceOptional) {
          decl += "?";
          forceOptional = true;
        }
        decl += ": ";
        let type = "any";
        if (paramMeta.type) {
          var tmp = null;
          if (qx.lang.Type.isArray(paramMeta.type)) {
            if (paramMeta.type.length == 1) {
              tmp = paramMeta.type[0];
            }
          } else {
            tmp = paramMeta.type;
          }
          if (tmp) {
            type = this.getType(tmp);
            if (tmp.dimensions) {
              type += "[]";
            }
          }
        }
        decl += type;
        return decl;
      });
      return arr.join(", ");
    },

    /**
     * Write all the methods of a type
     */
    writeMethods(methods, classMeta, isStatic = false) {
      if (!methods || !Object.keys(methods).length) {
        return;
      }
      if (this.checkOverride(name, isStatic ? "statics" : "members")) {
        return;
      }

      var IGNORE =
        qx.tool.compiler.targets.TypeScriptWriter.IGNORE[
          this.__currentClass.className
        ];

      for (var name in methods) {
        var methodMeta = methods[name];
        if (methodMeta.type == "function") {
          this.__writeMethod(name, {
            access: classMeta.type !== "interface" && methodMeta.access,
            abstract: classMeta.type !== "interface" && methodMeta.abstract,
            async: methodMeta.async,
            static: isStatic,
            mixin: methodMeta.mixin,
            parameters: methodMeta.params,
            returnType: methodMeta.returnType,
            jsdoc: methodMeta.jsdoc ?? {},
            hideMethod: IGNORE && IGNORE.indexOf(name) > -1
          });
        }
      }
    },

    /**
     * Escapes the name with quote marks, only if necessary
     *
     * @param name
     *          {String} the name to escape
     * @return {String} the escaped (if necessary) name
     */
    __escapeMethodName(name) {
      if (!name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        return '"' + name + '"';
      }
      return name;
    }
  },

  statics: {
    unknownTypeType: "QxUnknownType",

    IGNORE: {
      "qx.ui.virtual.core.CellEvent": ["init"],
      "qx.ui.table.columnmodel.resizebehavior.Default": ["set"],
      "qx.ui.progressive.renderer.table.Widths": ["set"],
      "qx.ui.table.columnmodel.resizebehavior": ["set"],
      "qx.ui.table.pane.CellEvent": ["init"],
      "qx.ui.mobile.dialog.Manager": ["error"],
      "qx.ui.mobile.container.Navigation": ["add"],
      "qx.ui.website.Table": ["filter", "sort"],
      "qx.ui.website.DatePicker": ["init", "sort"],
      "qx.event.type.Orientation": ["init"],
      "qx.event.type.KeySequence": ["init"],
      "qx.event.type.KeyInput": ["init"],
      "qx.event.type.GeoPosition": ["init"],
      "qx.event.type.Drag": ["init"],
      "qx.bom.request.SimpleXhr": ["addListener", "addListenerOnce"],
      "qx.event.dispatch.AbstractBubbling": ["dispatchEvent"],
      "qx.event.dispatch.Direct": ["dispatchEvent"],
      "qx.event.dispatch.MouseCapture": ["dispatchEvent"],
      "qx.event.type.Native": ["init"],
      "qx.html.Element": ["removeListener", "removeListenerById"],
      "qx.html.Flash": ["setAttribute"],
      "qx.util.LibraryManager": ["get", "set"]
    },

    TYPE_MAPPINGS: {
      Event: "qx.event.type.Event",
      LocalizedString: "qx.locale.LocalizedString",
      LayoutItem: "qx.ui.core.LayoutItem",
      Widget: "qx.ui.core.Widget",
      Decorator: "qx.ui.decoration.Decorator",
      MWidgetController: "qx.ui.list.core.MWidgetController",
      AbstractTreeItem: "qx.ui.tree.core.AbstractTreeItem",
      Axis: "qx.ui.virtual.core.Axis",
      ILayer: "qx.ui.virtual.core.ILayer",
      Pane: "qx.ui.virtual.core.Pane",
      IDesktop: "qx.ui.window.IDesktop",
      IWindowManager: "qx.ui.window.IWindowManager",
      DateFormat: "qx.util.format.DateFormat",
      Class: "qx.Class",
      Interface: "qx.Interface",
      Mixin: "qx.Mixin",
      Theme: "qx.Theme",
      Boolean: "boolean",
      Number: "number",
      String: "string",
      Color: "string",
      Font: "string",
      document: "Document",
      Stylesheet: "StyleSheet",
      Element: "HTMLElement",
      Object: "object",
      Map: "Record<string, any>",
      // TODO: deprecate the below types as they are non-standard aliases for builtin types without any tangible benefit
      var: "unknown",
      "*": "unknown",
      arguments: "unknown"
    }
  }
});
