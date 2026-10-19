// jsdom does not implement scrolling (used by the router's scrollBehavior).
window.scrollTo = (() => undefined) as typeof window.scrollTo
