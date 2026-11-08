/**
 * Pool.js
 * Minimal generic object pool. Reused for rabbits, particles and power-ups so
 * the game never churns the garbage collector during heavy waves.
 */

export class Pool {
  /**
   * @param {() => any} factory  builds a fresh instance
   * @param {number} prewarm     how many instances to build up front
   * @param {(item:any)=>void} [reset]  called when an item is released
   */
  constructor(factory, prewarm = 0, reset = null) {
    this.factory = factory;
    this.reset = reset;
    /** Items currently live. */
    this.active = [];
    /** Items available for reuse. */
    this.free = [];
    for (let i = 0; i < prewarm; i++) this.free.push(factory());
  }

  get activeCount() {
    return this.active.length;
  }

  acquire() {
    const item = this.free.pop() ?? this.factory();
    this.active.push(item);
    return item;
  }

  /** Release by index into the active list (swap-remove, order not stable). */
  releaseAt(index) {
    const item = this.active[index];
    const last = this.active.length - 1;
    if (index !== last) this.active[index] = this.active[last];
    this.active.pop();
    if (this.reset) this.reset(item);
    this.free.push(item);
    return item;
  }

  release(item) {
    const i = this.active.indexOf(item);
    if (i !== -1) this.releaseAt(i);
    return item;
  }

  releaseAll() {
    for (let i = this.active.length - 1; i >= 0; i--) this.releaseAt(i);
  }
}