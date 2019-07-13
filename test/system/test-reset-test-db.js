var test = require("tape-catch"),
    Promise = require("bluebird"),
    resetTestDb = require("./lib/reset-test-db");

test("sanity - after wiping the DB...", (t) => {
    resetTestDb()
    .then((db) => {
        db = Promise.promisifyAll(db);
        return db.listAsync();
    })
    .then((body) => {
        t.deepEquals(body.rows, [], "...is the db empty?");
    })
    .catch((e) => {
        if (e instanceof Error) {
            t.comment(e.stack);
            t.fail("...an error occurred");
        } else {
            t.comment(e.stack);
            t.fail("...an error occurred");
        }

        throw(e);
    })
    .finally(() => {
        t.end();
    });
});
