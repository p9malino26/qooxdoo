/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2011 1&1 Internet AG, Germany, http://www.1und1.de

   License:
     MIT: https://opensource.org/licenses/MIT
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Christian Hagendorn (chris_schmidt)

************************************************************************ */

/**
 * Implements the different selection modes single, multi, additive and one
 * selection with there drag and quick selection.
 *
 * Example how to use selection:
 * <pre class="javascript">
 * var rawData = [];
 * for (var i = 0; i < 2500; i++) {
 *  rawData[i] = "Item No " + i;
 * }
 *
 * var model = qx.data.marshal.Json.createModel(rawData);
 * var list = new qx.ui.list.List(model);
 *
 * // Pre-Select "Item No 20"
 * list.getSelection().push(model.getItem(20));
 *
 * // log change selection
 * list.getSelection().addListener("change", function(e) {
 *   this.debug("Selection: " + list.getSelection().getItem(0));
 * }, this);
 * </pre>
 *
 * @internal
 */
qx.Mixin.define("qx.ui.virtual.selection.MModel", {
  construct() {
    this._initSelectionManager();
    this.__selection = new qx.data.Array();
    this.__selection.addListener("change", this._onChangeSelection, this);
    this._applySelection(this.__selection, null);
  },

  properties: {
    /** Current selected items */
    /* psuedo property - implemented manually in code below
    selection :
    {
      check : "qx.data.Array",
      event : "changeSelection",
      apply : "_applySelection",
      nullable : false,
      deferredInit : true
    },
    */

    /**
     * The selection mode to use.
     *
     * For further details please have a look at:
     * {@link qx.ui.core.selection.Abstract#mode}
     */
    selectionMode: {
      check: ["single", "multi", "additive", "one"],
      init: "single",
      apply: "_applySelectionMode"
    },

    /**
     * Enable drag selection (multi selection of items through
     * dragging the pointer in pressed states).
     *
     * Only possible for the selection modes <code>multi</code> and <code>additive</code>
     */
    dragSelection: {
      check: "Boolean",
      init: false,
      apply: "_applyDragSelection"
    },

    /**
     * Enable quick selection mode, where no tap is needed to change the selection.
     *
     * Only possible for the modes <code>single</code> and <code>one</code>.
     */
    quickSelection: {
      check: "Boolean",
      init: false,
      apply: "_applyQuickSelection"
    }
  },

  events: {
    /**
     * This event is fired as soon as the content of the selection property changes, but
     * this is not equal to the change of the selection of the widget. If the selection
     * of the widget changes, the content of the array stored in the selection property
     * changes. This means you have to listen to the change event of the selection array
     * to get an event as soon as the user changes the selected item.
     * <pre class="javascript">obj.getSelection().addListener("change", listener, this);</pre>
     */
    changeSelection: "qx.event.type.Data",

    /** Fires after the value was modified */
    changeValue: "qx.event.type.Data"
  },

  members: {
    /** @type {qx.ui.virtual.selection.Row} selection manager */
    _manager: null,

    /** @type {Boolean} flag to ignore the selection change from {@link #selection} */
    __ignoreChangeSelection: false,

    /** @type {Boolean} flag to ignore the selection change from <code>_manager</code> */
    __ignoreManagerChangeSelection: false,

    __selection: null,

    /**
     * setValue implements part of the {@link qx.ui.form.IField} interface.
     *
     * @param selection {qx.data.IListData|null} List data to select as value.
     * @return {null} The status of this operation.
     */
    setValue(selection) {
      if (selection === null) {
        this.resetSelection();
      } else {
        this.setSelection(selection);
      }

      return null;
    },

    /**
     * getValue implements part of the {@link qx.ui.form.IField} interface.
     *
     * @return {qx.data.IListData} The current selection.
     */
    getValue() {
      return this.getSelection();
    },

    /**
     * resetValue implements part of the {@link qx.ui.form.IField} interface.
     */
    resetValue() {
      this.resetSelection();
    },

    /**
     * Initialize the selection manager with his delegate.
     */
    _initSelectionManager() {
      var self = this;
      var selectionDelegate = {
        isItemSelectable(row) {
          return self._provider.isSelectable(row);
        },

        styleSelectable(row, type, wasAdded) {
          if (type != "selected") {
            return;
          }

          if (wasAdded) {
            self._provider.styleSelectabled(row);
          } else {
            self._provider.styleUnselectabled(row);
          }
        }
      };

      this._manager = new qx.ui.virtual.selection.CellRectangle(
        this.getPane(),
        selectionDelegate
      );

      this._manager.attachPointerEvents(this.getPane());
      this._manager.attachKeyEvents(this);
      this._manager.addListener(
        "changeSelection",
        this._onManagerChangeSelection,
        this
      );
    },

    /**
     * Determines, if automatically scrolling of selected item is active.
     * Set <code>false</code> to suspend auto scrolling.
     *
     * @param value {Boolean} Set <code>false</code> to suspend auto scrolling.
     */
    setAutoScrollIntoView(value) {
      this._manager._autoScrollIntoView = value;
    },

    /**
     * Returns true, if automatically scrolling of selected item is active.
     *
     * @return {Boolean} Returns <code>false</code> if auto scrolling is suspended.
     */
    getAutoScrollIntoView() {
      return this._manager._autoScrollIntoView;
    },

    /**
     * Method to update the selection, this method can be used when the model has
     * changes.
     */
    _updateSelection() {
      if (this._manager == null) {
        return;
      }

      this._onChangeSelection();
    },

    /*
    ---------------------------------------------------------------------------
      APPLY ROUTINES
    ---------------------------------------------------------------------------
    */

    /**
     * Setter for selection property; takes the selection on, and does not change the
     * array instance in `this.selection`
     *
     * @param value {qx.data.Array} the new selection
     */
    setSelection(value) {
      if (value) {
        this.__selection.replace(value);
      } else {
        this.__selection.removeAll();
      }
    },

    /**
     * Getter for selection property
     *
     * @return {qx.data.Array}
     */
    getSelection() {
      return this.__selection;
    },

    /**
     * Reset for selection property
     */
    resetSelection() {
      this.__selection.removeAll();
    },

    /**
     * Init for selection property; takes the selection on, and does not change the
     * array instance in `this.selection`
     *
     * @param value {qx.data.Array} the new selection
     */
    initSelection(value) {
      this.warn(
        "Using initSelection on " +
          this.classname +
          " is probably not what you intended - the selection instance does not change"
      );

      this.setSelection(value);
    },

    /**
     * Apply method for selection property
     *
     * @param value {qx.data.Array} new value
     * @param old {qx.data.Array} old value
     */
    _applySelection(value, old) {
      this._onChangeSelection();
    },

    // apply method
    _applySelectionMode(value, old) {
      this._manager.setMode(value);
    },

    // apply method
    _applyDragSelection(value, old) {
      this._manager.setDrag(value);
    },

    // apply method
    _applyQuickSelection(value, old) {
      this._manager.setQuick(value);
    },

    /*
    ---------------------------------------------------------------------------
      SELECTION HANDLERS
    ---------------------------------------------------------------------------
    */

    /**
     * Event handler for the internal selection change {@link #selection}.
     *
     * @param e {qx.event.type.Data} the change event.
     */
    _onChangeSelection(e) {
      if (this.__ignoreManagerChangeSelection == true) {
        return;
      }

      this.__ignoreChangeSelection = true;
      var selection = this.getSelection();

      var newSelection = [];
      for (var i = 0; i < selection.getLength(); i++) {
        var item = selection.getItem(i);
        var selectables = this._getSelectables();
        var index = -1;

        if (selectables != null) {
          index = selectables.indexOf(item);
        }

        var row = this._reverseLookup(index);

        if (row !== null) {
          newSelection.push(row);
        }
      }

      if (
        this._beforeApplySelection != null &&
        qx.lang.Type.isFunction(this._beforeApplySelection)
      ) {
        this._beforeApplySelection(newSelection);
      }

      try {
        if (!qx.lang.Array.equals(newSelection, this._manager.getSelection())) {
          this._manager.replaceSelection(newSelection);
        }
      } catch (ex) {
        this._manager.selectItem(newSelection[newSelection.length - 1]);
      }
      this.__synchronizeSelection();

      if (
        this._afterApplySelection != null &&
        qx.lang.Type.isFunction(this._afterApplySelection)
      ) {
        this._afterApplySelection();
      }

      this.__ignoreChangeSelection = false;
    },

    /**
     * Event handler for the selection change from the <code>_manager</code>.
     *
     * @param e {qx.event.type.Data} the change event.
     */
    _onManagerChangeSelection(e) {
      if (this.__ignoreChangeSelection == true) {
        return;
      }

      this.__ignoreManagerChangeSelection = true;

      this.__synchronizeSelection();

      this.__ignoreManagerChangeSelection = false;

      this.fireDataEvent("changeValue", e.getData(), e.getOldData());
    },

    /**
     * Synchronized the selection form the manager with the local one.
     */
    __synchronizeSelection() {
      if (this.__isSelectionEquals()) {
        return;
      }

      var managerSelection = this._manager.getSelection();
      var newSelection = [];

      for (var i = 0; i < managerSelection.length; i++) {
        var item = this._getDataFromRow(managerSelection[i]);

        if (item != null) {
          newSelection.push(item);
        }
      }

      this.__replaceSelection(newSelection);
    },

    /**
     * Replace the current selection with the passed selection Array.
     *
     * @param newSelection {qx.data.Array} The new selection.
     */
    __replaceSelection(newSelection) {
      var selection = this.getSelection();
      if (newSelection.length > 0) {
        var args = [0, selection.getLength()];
        args = args.concat(newSelection);
        // dispose data array returned by splice to avoid memory leak
        var temp = selection.splice.apply(selection, args);
        temp.dispose();
      } else {
        selection.removeAll();
      }
    },

    /**
     * Checks whether the local and the manager selection are equal.
     *
     * @return {Boolean} <code>true</code> if the selections are equal,
     *   <code>false</code> otherwise.
     */
    __isSelectionEquals() {
      var selection = this.getSelection();
      var managerSelection = this._manager.getSelection();

      if (selection.getLength() !== managerSelection.length) {
        return false;
      }

      for (var i = 0; i < selection.getLength(); i++) {
        var item = selection.getItem(i);
        var selectables = this._getSelectables();
        var index = -1;

        if (selectables != null) {
          index = selectables.indexOf(item);
        }
        var row = this._reverseLookup(index);

        if (row !== null && !qx.lang.Object.equals(row, managerSelection[i])) {
          return false;
        }
      }
      return true;
    },

    /**
     * Helper Method to select default item.
     */
    _applyDefaultSelection() {
      if (this._manager != null) {
        this._manager._applyDefaultSelection();
      }
    }
  },

  destruct() {
    this._manager.dispose();
    this._manager = null;
    if (this.__selection) {
      this.__selection.dispose();
    }
  }
});
