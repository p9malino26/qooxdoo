/* ************************************************************************

   Copyright: 2023 ZenesisUK

   License: MIT license

   Authors: Will Johnson (WillsterJohnson)

************************************************************************ */

/**
 * The slot turns JSX from a syntax convenience into a declaratively expressive system.
 *
 * ! SLOTS ARE CURRENTLY ONLY SUPPORTED FOR JSX CUSTOM ELEMENT FUNCTIONS WHICH HAVE A NON-FRAGMENT ELEMENT AS THEIR JSX ROOT !
 *
 * ? Slots in all JSX expressions may be added in future
 *
 * ? Slots in fragment-rooted JSX expressions may be added in future
 *
 * Passing children to a custom tag:
 * ```jsx
 * const MyFirstSlot = () => (
 *   <p>
 *     <slot />
 *   </p>
 * );
 *
 * const UseFirstSlot = (
 *   <MyFirstSlot>
 *     Lorem Ipsum Dolor Sit Amet
 *   </MyFirstSlot>
 * );
 * ```
 * Output:
 * ```html
 * <p>
 *   Lorem Ipsum Dolor Sit Amet
 * </p>
 * ```
 *
 * Declared children of the slot are the default children to use when no
 * children are passed or injected. Default children may be *any* valid JSX.
 *
 * Slots are named by passing a `name` attribute to the slot, and used by
 * passing a corresponding `slot` attribute to the child. In this way, slots
 * can be used to declare multiple remote children of the Custom Tag.
 */
qx.Class.define("qx.html.Slot", {
  extend: qx.html.Element,

  /**
   * Creates a new Slot
   *
   * ! Intended for use with JSX, non-JSX use may yield unexpected results !
   * (will fix in future)
   *
   * @see constructor for {Element}
   */
  construct(slotName) {
    if (slotName?.includes(" ")) {
      throw new Error(
        `Slots may only have one name! (\`<slot name="${slotName}">\` cannot contain spaces)`
      );
    }
    super("slot", {}, { name: slotName ?? qx.html.Slot.DEFAULT_SLOT });
    this._defaultChildren = [];
  },

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members: {
    // this member variable is only used for IE browsers to be able
    // to the tag name which will be set. This is heavily connected to the runtime
    // change of decorators and the use of external (=unmanaged images). It is
    // necessary to be able to determine what tag will be used e.g. before the
    // ImageLoader has finished its loading of an external image.
    // See Bug #3894 for more details
    tagNameHint: null,

    /**@override */
    inject() {
      throw new Error(
        "Cannot inject into <slot>! Injections only work for the top-most element of a JSX expression."
      );
    },

    /**@override */
    _serializeImpl(serializer) {
      serializer.openTag(this._nodeName);
      serializer.pushQxObject(this);

      let id = serializer.getQxObjectIdFor(this);
      if (id) serializer.setAttribute("data-qx-object-id", `"${id}"`);

      // Children
      if (this._children?.length) {
        for (var i = 0; i < this._children.length; i++) {
          this._children[i]._serializeImpl(serializer);
        }
      } else {
        for (var i = 0; i < this._defaultChildren.length; i++) {
          this._defaultChildren[i]._serializeImpl(serializer);
        }
      }
      serializer.closeTag();
      serializer.popQxObject(this);
    },

    /*
    ---------------------------------------------------------------------------
      SLOT API
    ---------------------------------------------------------------------------
    */

    _defaultChildren: null,

    addDefaultChild(child) {
      try {
        this._defaultChildren.push(child);
      } catch (e) {
        throw new Error(
          "Cannot modify default children of <slot> outside of declaration!"
        );
      }
    },

    sealDefaultChildren() {
      Object.seal(this._defaultChildren);
    },

    getName() {
      return this.getAttribute("name");
    }
  },

  /*
  *****************************************************************************
     STATICS
  *****************************************************************************
  */
  statics: {
    DEFAULT_SLOT: "qx.html.Slot.__RESERVED_DEFAULT_SLOT__"
  }
});
