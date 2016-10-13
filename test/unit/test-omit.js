var test = require("tape-catch"),
    omit = require("../../lib/omit");

test("omitting a field from an object with no fields...", function (t) {
    var o1 = {};
    var result = omit(o1, "foo");
    t.notEqual(result, o1, "...results in a different object");
    t.end();
});

test("omitting a field from an object with no fields...", function (t) {
    var o1 = {};
    var result = omit(o1, "foo");
    t.deepEqual(result, o1, "...results in an equivalent object");
    t.end();
});

test("omitting a field from an object with only that field...", function (t) {
    var o1 = { foo: 1 };
    var result = omit(o1, "foo");
    t.deepEqual(result, {}, "...results in an empty object");
    t.end();
});

test("omitting a field from an object with several fields, including the provided field...", function (t) {
    var o1 = { foo: 1, bar: 2 };
    var result = omit(o1, "foo");
    var expected = { bar: 2 };
    t.deepEqual(result, expected, "...results in an object with that field removed");
    t.end();
});

test("omitting a field from an object with several fields, but not including that field...", function (t) {
    var o1 = { foo: 1, bar: 2 };
    var result = omit(o1, "baz");
    t.deepEqual(result, o1, "...results in an equivalent object");
    t.end();
});

