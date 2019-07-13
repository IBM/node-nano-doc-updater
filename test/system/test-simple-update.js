var test = require("tape-catch"),
    Promise = require("bluebird"),
    nanoDocUpdater = require("../../"),
    resetTestDb = require("./lib/reset-test-db");

test("after updating a document that already exists with no merge function...", (t) => {
    var db = null;
    var docId = "a";
    var docVersion1 = { a: 1 };
    var docVersion2 = { a: 2 };

    resetTestDb()
        .then((rawDb) => {
            db = Promise.promisifyAll(rawDb);
            return db.insert({_id: docId, ...docVersion1});
        })
        .then(() => {
            var updater = nanoDocUpdater()
                .db(db)
                .newDoc(docVersion2)
                .id(docId);

            return Promise.promisify(updater.update.bind(updater))();
        })
        .then(() => {
            return db.getAsync(docId);
        })
        .then((d) => {

            t.equal(d._id, "a", "...does the inserted document id match what we provided to NanoDocUpdater?");

            Object.getOwnPropertyNames(docVersion2).forEach((field) => {
                t.equal(
                    d[field],
                    docVersion2[field],
                    "...does the '" + field + "' field in the inserted document match what we provided to NanoDocUpdater?"
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

