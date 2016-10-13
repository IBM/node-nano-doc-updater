var test = require("tape-catch"),
    Promise = require("bluebird"),
    nanoDocUpdater = require("../../"),
    resetTestDb = require("./lib/reset-test-db");

test("after updating a document that didn't already exist with shouldCreate(false)...", (t) => {
    var db = null;
    var docId = "a";
    var doc = { a: 1 };

    resetTestDb()
    .then((rawDb) => {
        db = Promise.promisifyAll(rawDb);

        var updater = nanoDocUpdater()
        .db(rawDb)
        .newDoc(doc)
        .shouldCreate(false)
        .id(docId);

        return Promise.promisify(updater.update, updater)();
    })
    .then(() => {
        return db.getAsync(docId);
    })
    .then(() => {
        t.fail("...the document was inserted into the database.");
    })
    .catch(NotFoundError, () => {
        t.pass("...the document was not inserted into the database.");
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

function NotFoundError(e) {
    return e && e.error === "not_found";
}
