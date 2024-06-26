/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2007-2012 1&1 Internet AG, Germany, http://www.1und1.de

   License:
     MIT: https://opensource.org/licenses/MIT
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Martin Wittemann (martinwittemann)

************************************************************************ */

/**
 * testResolve-Class for testResolveing the single value binding
 */
qx.Class.define("qx.test.data.async.Resolve", {
  extend: qx.dev.unit.TestCase,

  members: {
    testResolveDepth1() {
      var model = qx.data.marshal.Json.createModel({ a: 12 });
      this.assertEquals(
        12,
        qx.data.SingleValueBindingAsync.resolvePropertyChain(model, "a")
      );

      model.dispose();
    },

    testResolveDepth2() {
      var model = qx.data.marshal.Json.createModel({ a: { b: 12 } });
      this.assertEquals(
        12,
        qx.data.SingleValueBindingAsync.resolvePropertyChain(model, "a.b")
      );

      model.dispose();
    },

    testResolveDepthHuge() {
      var model = qx.data.marshal.Json.createModel({
        a: { b: { c: { d: { e: { f: 12 } } } } }
      });

      this.assertEquals(
        12,
        qx.data.SingleValueBindingAsync.resolvePropertyChain(
          model,
          "a.b.c.d.e.f"
        )
      );

      model.dispose();
    },

    testResolveArrayIndex() {
      var arr = new qx.data.Array([23]);
      this.assertEquals(
        23,
        qx.data.SingleValueBindingAsync.resolvePropertyChain(arr, "[0]")
      );
    },

    testResolveWithArray() {
      var model = qx.data.marshal.Json.createModel({ a: { b: [{ c: 12 }] } });
      this.assertEquals(
        12,
        qx.data.SingleValueBindingAsync.resolvePropertyChain(model, "a.b[0].c")
      );

      model.dispose();
    },

    testResolveNestedArray() {
      var model = qx.data.marshal.Json.createModel({ a: [[23]] });
      this.assertEquals(
        23,
        qx.data.SingleValueBindingAsync.resolvePropertyChain(model, "a[0][0]")
      );

      model.dispose();
    },

    testResolveNotExistant() {
      var model = qx.data.marshal.Json.createModel({ a: 12 });
      this.assertException(function () {
        this.assertEquals(
          12,
          qx.data.SingleValueBindingAsync.resolvePropertyChain(model, "b")
        );
      });
      model.dispose();
    }
  }
});
