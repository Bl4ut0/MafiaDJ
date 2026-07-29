const test = require('node:test');
const assert = require('node:assert/strict');
const { Queue } = require('../dist/player/Queue');

function track(title) {
    return {
        title,
        artist: 'Artist',
        url: `https://www.youtube.com/watch?v=${title}`,
        thumbnail: '',
        duration: 60,
        source: 'youtube',
        requesterId: 'user',
        addedAt: Date.now(),
    };
}

test('Queue enforces its configured capacity for single and bulk inserts', () => {
    const queue = new Queue(2);
    assert.equal(queue.enqueue(track('one')), true);
    assert.equal(queue.enqueueMany([track('two'), track('three')]), 1);
    assert.equal(queue.size(), 2);
    assert.equal(queue.remainingCapacity(), 0);
    assert.equal(queue.enqueue(track('four')), false);
    assert.equal(queue.insertAt(0, track('five')), false);
});

test('Queue returns copies and validates move/remove bounds', () => {
    const queue = new Queue(3);
    queue.enqueueMany([track('one'), track('two')]);
    const snapshot = queue.getTracks();
    snapshot.length = 0;
    assert.equal(queue.size(), 2);
    assert.equal(queue.move(0, 1), true);
    assert.equal(queue.getTracks()[0].title, 'two');
    assert.equal(queue.remove(9), null);
});
