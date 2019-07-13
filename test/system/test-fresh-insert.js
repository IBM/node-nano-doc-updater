var test = require("tape-catch"),
    Promise = require("bluebird"),
    nanoDocUpdater = require("../../"),
    resetTestDb = require("./lib/reset-test-db");

test("after updating a document that didn't already exist...", (t) => {
    var db = null;
    var docId = "a";
    var doc = { a: 1 };

    resetTestDb()
    .then((rawDb) => {
        db = Promise.promisifyAll(rawDb);

        var updater = nanoDocUpdater()
        .db(rawDb)
        .newDoc(doc)
        .id(docId);

        return Promise.promisify(updater.update.bind(updater))();
    })
    .then(() => {
        return db.getAsync(docId);
    })
    .then((d) => {
        t.equal(d._id, "a", "...does the inserted document id match what we provided to NanoDocUpdater?");
        t.equal(d.a, doc.a, "...does the field in the inserted document match what we provided to NanoDocUpdater?");
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
