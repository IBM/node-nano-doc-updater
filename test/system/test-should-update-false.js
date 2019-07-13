var test = require("tape-catch"),
    Promise = require("bluebird"),
    nanoDocUpdater = require("../../"),
    resetTestDb = require("./lib/reset-test-db");

test("after updating a document that already exists with shouldUpdate=() => { return false; }...", (t) => {
    var db = null;
    var docId = "a";
    var docVersion1 = { a: 1 };
    var docVersion2 = { a: 2 };

    resetTestDb()
    .then((rawDb) => {
        db = Promise.promisifyAll(rawDb);
        return db.insert(docVersion1, docId);
    })
    .then(() => {
        var updater = nanoDocUpdater()
        .shouldUpdate(() => { return false; })
        .db(db)
        .newDoc(docVersion2)
        .id(docId);

        return Promise.promisify(updater.update.bind(updater))();
    })
    .then(() => {
        return db.getAsync(docId);
    })
    .then((d) => {
        Object.getOwnPropertyNames(docVersion1).forEach((field) => {
            t.equal(
                d[field],
                docVersion1[field],
                "...was the '" + field + "' of the document unchanged by NanoDocUpdater?"
            );
        });
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

