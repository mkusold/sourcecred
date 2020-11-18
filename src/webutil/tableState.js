// @flow

import {type PluckFn} from "../util/sortBy";
import sortBy from "../util/sortBy";
import {useMemo, useState, useCallback} from "react";

export const SortOrders = {
  ASC: "asc",
  DESC: "desc",
};
type SortOrderTypes = "asc" | "desc";

export const DEFAULT_SORT = SortOrders.ASC;

/**
  A state manager for a React data table that provides encapsuled hooks for Sort, Pagination, and Filtering.
  Useful for any table that needs at least one of those features, and particularly useful for managing combinations.

  EXAMPLES:
  Import:
      import {useTableState, SortOrders, DEFAULT_SORT} from "../../webutil/tableState";
  Preparation:
      const [DATE_SORT] = useState({name: "Date", fn: (e: LedgerEvent) => e.ledgerTimestamp});
      const [PAGINATION_OPTIONS] = useState([25, 50, 100]);
      const ts = useTableState(eventLog, {
        initialRowsPerPage: PAGINATION_OPTIONS[0],
        initialSort: {
          sortName: DATE_SORT.name,
          sortOrder: SortOrders.DESC,
          sortFn: DATE_SORT.fn,
        }
      });
  Pagination:
      <TablePagination
        rowsPerPageOptions={PAGINATION_OPTIONS}
        component="div"
        count={ts.length}
        labelRowsPerPage="Rows"
        rowsPerPage={ts.rowsPerPage}
        page={ts.pageIndex}
        onChangePage={(event, newPage) => ts.setPageIndex(newPage)}
        onChangeRowsPerPage={(event) => ts.setRowsPerPage(event.target.value)}
      />
  Filtering:
      <input type="text" onChange={(event) => {
        //Do not include an Event object from the DOM in the filter function as Event objects do not persist.
        const value = event.target.value;
        ts.createOrUpdateFilterFn(
          "filterEventName",
          (ledgerEvent) => ledgerEvent.action.type.replace("_", " ").toLowerCase().includes(value.toLowerCase())
        )    
      }}/>
  Sorting:
      <TableSortLabel
          active={ts.sortName === DATE_SORT.name}
          direction={
            ts.sortName === DATE_SORT.name ? ts.sortOrder : DEFAULT_SORT
          }
          onClick={() => ts.setSortFn(DATE_SORT.name, DATE_SORT.fn)}
      >Date</TableSortLabel>
 */
export type TableState<T> = {|
  /**
    A stateful representation of the current page data.
   */
  +currentPage: $ReadOnlyArray<T>,
  /**
    A stateful representation of the length of the filtered unpaginated data.
   */
  +length: number,
  /**
    A stateful representation of the current page index.
   */
  +pageIndex: number,
  /**
    A stateful representation of the number of rows per page.
   */
  +rowsPerPage: number,
  /**
    A stateful representation of the current sort name (the last sort name passed to setSortFn).
   */
  +sortName: string,
  /**
    A stateful representation of the current order, represented by "asc" or "desc".
   */
  +sortOrder: SortOrderTypes,
  /**
    A function that changes the currentPage to represent the indicated index.
   */
  +setPageIndex: (number) => void,
  /**
    A function that sets the rows per page and updates the pageIndex to an equivalent place.
   */
  +setRowsPerPage: (number) => void,
  /**
    A function that adds a filter to the map of filters or overwrites an existing filter that matches the key.
    Every filter stored will be applied together as an AND operation (results will only include elements
    that pass all filters).
    Sets pageIndex to 0.

    string: A key that represents the filter in the map.
    function?: A function that returns false if an element should be excluded from the result. Null to remove the filter at the key.
   */
  +createOrUpdateFilterFn: (string, null | ((T) => boolean)) => void,
  /**
    A function that sorts the data. Current pageIndex is maintained.

    string: A key representing the sort field. It is is used to toggle sort order and increase efficiency.
    function?: A function that returns the property of the element that should be used in the sort comparator.
   */
  +setSortFn: (string, PluckFn<T>) => void,
|};

/**
  A builder function for initializing a new TableState for use in a ReactNode.
  It encapsulates Sort, Pagination, and Filtering.
 */
export function useTableState<T>(
  // The base array. It should ideally be memoized before being passed in.
  data: Array<T>,
  initialOptions?: {
    // The initial rows per page. Defaults to unpaginated.
    initialRowsPerPage?: number,
    // Defaults to unsorted (maintains order of the original data).
    initialSort?: {
      // The starting order of the initial sort, represented by "asc" or "desc".
      sortOrder: SortOrderTypes,
      // A key representing the sort field. It is is used to toggle sort order and increase efficiency.
      sortName: string,
      // A function that returns the property of the element that should be used in the sort comparator.
      sortFn: PluckFn<T>,
    },
  }
): TableState<T> {
  const optionDefaults = {
    initialRowsPerPage: data.length,
    initialSort: {},
    ...initialOptions,
  };
  const sortDefaults = {
    sortOrder: SortOrders.ASC,
    sortName: "",
    sortFn: null,
    ...optionDefaults.initialSort,
  };
  const [sortName, setSortName] = useState(sortDefaults.sortName);
  const [sortOrder, setSortOrder] = useState<SortOrderTypes>(
    sortDefaults.sortOrder
  );
  const [sortFn, setSortFn] = useState(() => sortDefaults.sortFn);
  const [pageIndex, setPageIndex] = useState(0);
  const [rowsPerPage, setRowsPerPageInternal] = useState(
    optionDefaults.initialRowsPerPage
  );
  type FilterFns = {[string]: null | ((T) => boolean)};
  const [filterFns, setFilterFns] = useState<FilterFns>({});

  const sortedArray = useMemo(() => {
    const array = data.slice();
    if (sortFn) {
      sortBy(array, sortFn);
      if (sortOrder === SortOrders.DESC) array.reverse();
    }
    return array;
  }, [data, sortFn, sortOrder]);

  const filteredArray = useMemo(() => {
    const reducer = (array, key) => {
      const fn = filterFns[key];
      if (fn) return array.filter(fn);
      return array;
    };
    return Object.keys(filterFns).reduce(reducer, sortedArray);
  }, [sortedArray, filterFns]);

  const setRowsPerPage = useCallback((newRowsPerPage: number) => {
    // Keep the user from losing their place when changing # of results per page
    const intRowsPerPage = parseInt(newRowsPerPage, 10);
    const currentFirstVisibleRow = pageIndex * rowsPerPage;
    const newPage = Math.floor(currentFirstVisibleRow / intRowsPerPage);

    setRowsPerPageInternal(intRowsPerPage);
    setPageIndex(newPage);
  });

  const setSortFnCallback = useCallback(
    (newSortName: string, newSortFn: PluckFn<T>) => {
      if (newSortName === sortName) {
        setSortOrder(
          sortOrder === SortOrders.DESC ? SortOrders.ASC : SortOrders.DESC
        );
      } else {
        setSortOrder(DEFAULT_SORT);
        setSortFn(() => newSortFn);
      }
      setSortName(newSortName);
    }
  );

  const createOrUpdateFilterFn = useCallback(
    (key: string, newFilterFn: null | ((T) => boolean)) => {
      const setterFn: (FilterFns) => FilterFns = (fns) => {
        return {
          ...fns,
          [key]: newFilterFn,
        };
      };
      setPageIndex(0);
      setFilterFns(setterFn);
    }
  );

  const currentPage = useMemo(
    () =>
      filteredArray.slice(
        pageIndex * rowsPerPage,
        pageIndex * rowsPerPage + rowsPerPage
      ),
    [filteredArray, pageIndex, rowsPerPage]
  );

  const length = filteredArray.length;

  return {
    pageIndex,
    setPageIndex,
    rowsPerPage,
    sortName,
    sortOrder,
    setRowsPerPage,
    createOrUpdateFilterFn,
    setSortFn: setSortFnCallback,
    currentPage,
    length,
  };
}
