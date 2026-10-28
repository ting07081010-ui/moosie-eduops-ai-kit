export const DEFAULT_MAX_CONCURRENT_AUDIO_NORMALIZATIONS = 2;
export const DEFAULT_MAX_QUEUED_AUDIO_NORMALIZATIONS = 4;

/**
 * Bounded FIFO admission for audio requests. Waiting requests occupy queue
 * entries, not active permits; a full queue is rejected synchronously.
 */
export function createAudioAdmissionController({
  maxActive = DEFAULT_MAX_CONCURRENT_AUDIO_NORMALIZATIONS,
  maxQueued = DEFAULT_MAX_QUEUED_AUDIO_NORMALIZATIONS,
} = {}) {
  if (!Number.isSafeInteger(maxActive) || maxActive < 1 || maxActive > 8 ||
      !Number.isSafeInteger(maxQueued) || maxQueued < 0 || maxQueued > 32) {
    throw new RangeError("Audio admission limits are outside their safe bounds.");
  }

  let active = 0;
  const queue = [];

  function makeRelease() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      while (queue.length > 0) {
        const next = queue.shift();
        if (next.cancelled) continue;
        next.granted = true;
        next.resolve(makeRelease());
        return;
      }
      active--;
    };
  }

  return {
    acquire() {
      if (active < maxActive) {
        active++;
        return { accepted: true, ready: Promise.resolve(makeRelease()), cancel: () => false };
      }
      if (queue.length >= maxQueued) return { accepted: false };

      let resolve;
      const ready = new Promise((done) => { resolve = done; });
      const entry = { resolve, cancelled: false, granted: false };
      queue.push(entry);
      return {
        accepted: true,
        ready,
        cancel() {
          if (entry.granted || entry.cancelled) return false;
          const index = queue.indexOf(entry);
          if (index < 0) return false;
          queue.splice(index, 1);
          entry.cancelled = true;
          entry.resolve(null);
          return true;
        },
      };
    },
    get activeCount() { return active; },
    get queuedCount() { return queue.length; },
  };
}
