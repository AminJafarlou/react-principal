import React from "react";
import { createContext, useContext } from "react";
import { Provider, ProviderProps } from ".";
import { useObserveContext, createObserveContext } from "./observe";
import { INITIALIZE_STATE_FROM_STORAGE } from "./persist";
import { Reducer } from "./types";
export interface Store<S> {
  useState(nextObserveState?: (keyof S)[]): S;
  useDispatch(): (action: any, callback?: () => void) => void;
  persist(
    state: S,
    action: {
      type: any;
    },
  ): void;
  setToState(): Promise<void>;
  dispatch: (action: any, callback?: () => void) => void;
  state: S;
  Provider: (props: Omit<ProviderProps<any>, "store">) => any;
}

export interface PrivateStore<S> extends Store<S> {
  stateContext: React.Context<S>;
  dispatchContext: React.Context<(action: any, callback?: () => void) => void>;
  reducer: Reducer<S>;
  initialState: S;
  persistKey?: string;
}

/**
 * This function give you an store, use that in your components which want to
 * connect to store and provider
 */
export const createStore = <T extends { [x: string]: any }>({
  reducer,
  initialState,
  mapStateToPersist,
  storage = window.localStorage,
  persistKey,
}: {
  reducer: Reducer<T>;
  initialState: T;
  /** Window.localStorage, window.sessionStorage, AsyncStorage supported */
  storage?: any;
  persistKey?: string;
  mapStateToPersist?: (state: T) => Partial<T>;
}): Store<T> => {
  const stateContext = createObserveContext(initialState);
  const dispatchContext = createContext<(action: any, callback?: any) => void>(
    () => {},
  );

  function syncTabs(event: StorageEvent) {
    const { dispatch } = store;

    if (event.key === persistKey && event.newValue !== event.oldValue) {
      dispatch({
        type: INITIALIZE_STATE_FROM_STORAGE,
        payload: event.newValue ? JSON.parse(event.newValue) : event.newValue,
      });
    }
  }

  const store: PrivateStore<T> = {
    persistKey,
    dispatch: () => {},
    state: initialState,
    stateContext,
    dispatchContext,
    reducer,
    initialState,
    useState: (nextObserveState?: (keyof T)[]): T => {
      return useObserveContext(stateContext, nextObserveState);
    },
    useDispatch: () => useContext(dispatchContext),
    persist(state: T, action: { type: any }) {
      if (action.type !== INITIALIZE_STATE_FROM_STORAGE) {
        storage.setItem(
          persistKey,
          JSON.stringify(mapStateToPersist ? mapStateToPersist(state) : state),
        );
      }
    },
    Provider: (props) => {
      return <Provider store={store} {...props} />;
    },
    async setToState() {
      try {
        const storedState = await storage.getItem(persistKey);

        if (!storedState) {
          return;
        }

        const stateObject = JSON.parse(storedState);

        const { dispatch } = store;
        const mappedState = mapStateToPersist
          ? mapStateToPersist(stateObject)
          : stateObject;

        dispatch({
          type: INITIALIZE_STATE_FROM_STORAGE,
          payload: mappedState,
        });

        if (persistKey) {
          /** Remove previously added event */
          window.removeEventListener?.("storage", syncTabs);
          /** Listening to events between tabs */
          window.addEventListener?.("storage", syncTabs);
        }
      } catch (error) {
        if (__DEV__) {
          console.error(error);
        }
      }
    },
  };

  return store as Store<T>;
};
