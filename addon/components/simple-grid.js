import Ember from 'ember';
import layout from '../templates/components/simple-grid';

import CspStyleMixin from 'ember-cli-csp-style/mixins/csp-style';

const { Component, computed, A, $, observer, run, get, set } = Ember;

export default Component.extend(CspStyleMixin, {
  layout,

  styleBindings: ['position'],
  classNames: ['simple-grid'],

  /**
   * Allows parent of component to trigger a reflow (e.g., where the user resized the browser)
   * @type {Boolean}
   */
  reflowGrid: false,

  /**
   * Prebuild position value
   * @type {String}
   */
  position: 'relative',

  /**
   * Default column width
   * @type {Number}
   */
  columnWidth: computed('columns', 'layoutWidth', function() {
    const {
      columns, layoutWidth, gutter
    } = this.getProperties(      'columns', 'layoutWidth', 'gutter'
    );

    return Math.ceil((layoutWidth / columns) - gutter);
  }),

  /**
   * Width of grid
   * @type {Number}
   */
  layoutWidth: computed('layoutWidth', 'columns', 'columnWidth', 'gutter', 'innerWidth', function() {
    let innerWidth = get(this, 'innerWidth');
    let currentWidth = this.$().width();
    return innerWidth > currentWidth ? innerWidth : currentWidth;
  }),

  /**
   * Count of columns
   * @type {Number}
   */
  columns: 3,

  /**
   * Margin between columns
   * @type {Number}
   */
  gutter: 10,

  /**
   * List of items for rendering
   * @type {Array}
   */
  items: computed(() => A()),

  /**
   * Mode of grid layout
   * @type {[type]}
   */
  mode: 'default',

  /**
   * List of column indexes
   * @return {Array} [description]
   */
  colContainers: computed('columns', function() {
    const columns = get(this, 'columns');
    const colContainers = A();

    for (let i = 0; i < columns; i++) {
      colContainers.push({
        index: i,
        height: 0,
      })
    }

    return colContainers;
  }),

  /**
   * List of heights of columns
   * @return {Array} [description]
   */
  columnHeights: computed('columns', 'items.[]', function() {
    const {
      items,
      gutter,
      colContainers,
    } = this.getProperties(      'items',
      'gutter',
      'colContainers',
    );

    const _itemsPerColumns = colContainers.map(function(c) {
      return items.filter((i) => {
        return get(i, 'column') === c.index;
      });
    });

    return _itemsPerColumns.map(function(columnItems, index) {
      set(colContainers[index], 'height', columnItems.reduce((acc, item) => {
        let elemHeight = $(get(item, 'element')).height() || 0;
        return acc + gutter + elemHeight;
      }, 0));

      return colContainers[index];
    });
  }),

  /**
   * Object represent of highes column
   * @return {Object} [description]
   */
  highestColumn: computed('columnHeights.[]', function() {
    const {
      columnHeights
    } = this.getProperties(      'columnHeights'
    );

    const highestColumn = columnHeights.slice(
      0, columnHeights.length
    ).sort((a, b) => a.height > b.height ? -1 : 1)[0];

    if (highestColumn.index === -1) {
      return {
        index: 0,
        height: 0
      };
    }

    return highestColumn;
  }),

  /**
   * Object represent of lowest column
   * @return {Object} [description]
   */
  lowestColumn: computed('columnHeights.[]', function() {
    const {
      columnHeights
    } = this.getProperties('columnHeights');

    const lowestColumn = columnHeights.slice(
      0, columnHeights.length
    ).sort((a, b) => a.height > b.height ? 1 : -1)[0];

    if (lowestColumn.index === -1) {
      return {
        index: 0,
        height: 0
      };
    }

    return lowestColumn;
  }),

  gridRerender: observer('innerWidth', function() {
    if (get(this, 'innerWidth') > 0) {
      set(this, 'innerWidth', 0);
      this.fireRerender();
    }
  }),

  columnsRerender: observer('columns', function() {
    this.fireRerender();
  }),

  /**
   * Process if new Item
   * @param  {Object} item Placed item
   */
  placeItem(item) {
    const {
      items,
      lowestColumn,
    } = this.getProperties(
      'lowestColumn',
      'items',
    );

    if(get(item, 'isDestroyed')) {
      return;
    }

    run(() => {
      run.schedule('render', () => {
        item.setProperties({
          column: lowestColumn.index,
          top: lowestColumn.height,
          width: get(this, 'columnWidth'),
        });
      });
    })

    items.pushObject(item);
  },

  reRenderItems() {
    const items = get(this, 'items')
    const clonedItems = items.slice(0, get(items, 'length')).filter(
      (i) => {
        return !i.isDestroyed;
      }
    );

    items.clear();

    clonedItems.forEach((i) =>
      run.schedule('afterRender', () =>
        this.placeItem(i)
      )
    );
  },

  rerenderPartItems() {
    const { items } = this.getProperties('items');
    const itemsShouldRerender = items.filter(
      (item) => item.shouldRerender
    );

    const indexStartRerender = items.indexOf(
      itemsShouldRerender[0]
    );

    if (indexStartRerender === -1) {
      return;
    }

    this.rerenderAfterIndex(indexStartRerender);
  },

  rerenderAfterItem(item) {
    const { items } = this.getProperties('items');
    const indexStartRerender = items.indexOf(item);

    if (indexStartRerender === -1) {
      return;
    }

    this.rerenderAfterIndex(indexStartRerender);
  },

  rerenderAfterIndex(indexStartRerender) {
    const {
      items,
      isDestroyed
    } = this.getProperties(
      'items',
      'isDestroyed'
    );

    if (isDestroyed) {
      return;
    }

    const cloned = items.slice(
      indexStartRerender,
      get(items, 'length')
    );

    items.removeObjects(
      items.slice(indexStartRerender, get(items, 'length'))
    );

    cloned.forEach((item) => {
      this.placeItem(item);
    });

    run.next(() => {
      run.scheduleOnce('afterRender', this, this.setHeight);
    });
  },

  fireRerender() {
    const { schedule, isDestroyed } = this.getProperties('schedule', 'isDestroyed');

    if (isDestroyed) {
      return;
    }

    if (schedule) {
      run.cancel(schedule);
    }

    const runSchedule = run.next(() => {
      run.scheduleOnce('afterRender', this, this.reRenderItems);
    });

    this.set('schedule', runSchedule);
  },

  fireRerenderPart() {
    const { schedule, isDestroyed } = this.getProperties('schedule', 'isDestroyed');

    if (isDestroyed) {
      return;
    }

    if (schedule) {
      run.cancel(schedule);
    }

    const runSchedule = run.next(() => {
      run.scheduleOnce('afterRender', this, this.rerenderPartItems);
    });

    this.set('schedule', runSchedule);
  },

  setHeight() {
    const highestColumn = get(this, 'highestColumn');

    this.$().css({
      height: highestColumn.height,
    });
  }
});
