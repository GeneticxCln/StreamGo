/**
 * Batch DOM updates to minimize reflows and improve performance
 */

let rafPending = false;
let updateQueue: Array<() => void> = [];

/**
 * Schedule a DOM update to run in the next animation frame
 * All updates scheduled in the same frame will be batched together
 */
export function scheduleUpdate(callback: () => void): void {
  updateQueue.push(callback);
  
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const callbacks = updateQueue.slice();
      updateQueue = [];
      
      // Batch all DOM reads first, then writes
      callbacks.forEach(cb => cb());
    });
  }
}

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func.apply(this, args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function call to run at most once per specified time
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Batch multiple style changes to minimize reflows
 */
export function batchStyleUpdates(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>
): void {
  scheduleUpdate(() => {
    Object.assign(element.style, styles);
  });
}

/**
 * Read DOM properties in a batched way
 */
export function batchRead<T>(callback: () => T): Promise<T> {
  return new Promise((resolve) => {
    scheduleUpdate(() => {
      resolve(callback());
    });
  });
}

/**
 * Create a frame scheduler that runs tasks spread across multiple frames
 * to avoid blocking the main thread
 */
export function createFrameScheduler() {
  const tasks: Array<() => void> = [];
  let isRunning = false;
  
  function processTasks() {
    if (tasks.length === 0) {
      isRunning = false;
      return;
    }
    
    const start = performance.now();
    const FRAME_BUDGET = 16; // ~60fps
    
    while (tasks.length > 0 && (performance.now() - start) < FRAME_BUDGET) {
      const task = tasks.shift();
      if (task) task();
    }
    
    if (tasks.length > 0) {
      requestAnimationFrame(processTasks);
    } else {
      isRunning = false;
    }
  }
  
  return {
    schedule: (task: () => void) => {
      tasks.push(task);
      if (!isRunning) {
        isRunning = true;
        requestAnimationFrame(processTasks);
      }
    },
    clear: () => {
      tasks.length = 0;
      isRunning = false;
    }
  };
}
