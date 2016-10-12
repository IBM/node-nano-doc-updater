var test = require("tape-catch"),
    extend = require("../../lib/extend");

test("extending an empty object with a single empty object...", function (t) {
    var o1 = {};
    extend(o1, {});
    t.deepEqual(o1, {}, "...results in an empty object");
    t.end();
});

test("extending an empty object with several empty objects...", function (t) {
    var o1 = {};
    extend(o1, {}, {}, {});
    t.deepEqual(o1, {}, "...results in an empty object");
    t.end();
});

test("extending an empty object with a non-empty object...", function (t) {
    var o1 = {},
        o2 = { a: 1 };

    extend(o1, o2);
    t.deepEqual(o1, o2, "...results in clone of the non-empty object");
    t.end();
});

test("extending an empty object with several non-empty objects ", function (t) {
    var o1 = {},
        o2 = { a: 1 },
        o3 = { b: 2 },
        intended = { a: 1, b: 2 };

    extend(o1, o2, o3);
    t.deepEqual(o1, intended, "...results in an object merging all of the source objects' elements");
    t.end();
});

test("extending an object with a source object that contains overlapping keys...", function (t) {
    var o1 =        { a: "old", b: "older", c: "oldest" },
        o2 =        { a: "new", b: "newer" },
        merged =    { a: "new", b: "newer", c: "oldest"};

    extend(o1, o2);

    t.deepEqual(o1, merged, "...results in a properly merged object");
    t.end();
});

test("extend() returns...", function (t) {
    var o1 = {};
    var o2 = {};
    var extendResult = extend(o1, o2);
    t.equal(o1, extendResult, "...the target object (first argument)");
    t.notEqual(o2, extendResult, "...not the first source object (second argument)");
    t.end();
});
