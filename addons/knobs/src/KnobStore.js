const callArg = fn => fn();
const callAll = fns => fns.forEach(callArg);

export default class KnobStore {
  constructor() {
    this.store = {};
    this.callbacks = [];
  }

  has(groupId, name) {
    return this.store[groupId] && this.store[groupId][name] !== undefined;
  }

  set(groupId, name, value) {
    if (!this.store[groupId]) {
      this.store[groupId] = {};
    }
    this.store[groupId][name] = value;
    this.store[groupId][name].used = true;

    // debounce the execution of the callbacks for 50 milliseconds
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(callAll, 50, this.callbacks);
  }

  get(groupId, name) {
    const properGroupId = groupId === undefined ? '' : groupId;
    const knob = this.store[properGroupId] && this.store[properGroupId][name];
    if (knob) {
      knob.used = true;
    }
    return knob;
  }

  getAll() {
    return this.store;
  }

  reset() {
    this.store = {};
  }

  markAllUnused() {
    Object.keys(this.store).forEach(groupId => {
      Object.keys(this.store[groupId]).forEach(name => {
        this.store[groupId][name].used = false;
      });
    });
  }

  subscribe(cb) {
    this.callbacks.push(cb);
  }

  unsubscribe(cb) {
    const index = this.callbacks.indexOf(cb);
    this.callbacks.splice(index, 1);
  }
}
