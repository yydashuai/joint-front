/**
 * 轻量级跨组件事件总线（无依赖，基于 EventTarget）。
 * 用于解耦 store 变更与跨页 UI 刷新（如 Dashboard 实时联动 Execution/Exception）。
 */

class Bus extends EventTarget {
  emit(type, payload) {
    this.dispatchEvent(new CustomEvent(type, { detail: payload }))
  }
  on(type, handler) {
    const wrapped = (e) => handler(e.detail)
    this.addEventListener(type, wrapped)
    return () => this.removeEventListener(type, wrapped)
  }
  off(type, handler) {
    this.removeEventListener(type, handler)
  }
}

export const bus = new Bus()

export const EVENTS = {
  TASK_RUN_FINISHED: 'task:run-finished',
  TASK_RUN_STARTED: 'task:run-started',
  EXCEPTION_UPDATED: 'exception:updated',
  EXCEPTION_CREATED: 'exception:created',
  PROTOCOL_SAVED: 'protocol:saved',
  CONNECTION_CHANGED: 'connection:changed'
}
