var test = require("tape-catch"),
    Promise = require("bluebird"),
    resetTestDb = require("./lib/reset-test-db"),
    nanoDocUpdater = require("../../");

test("while testing the scenario from the README...", (t) => {
    var db = null;
    var designDocId = "_design/foo",
        otherDocId = "foo",
        designDoc1 = { language: "javascript", version: 1 };

    /* eslint-disable */
    var designDoc2 = {
        language: "javascript",
        version: 2,
        views: {
            count: {
                map: 'function (d) { emit(null, 1); }',
                reduce: 'function (k, v, r) { sum(v); }'
            }
        }
    }; /* eslint-enable */

    var updater = null;

    resetTestDb()
        .then((rawDb) => {
            db = Promise.promisifyAll(rawDb);
            updater = nanoDocUpdater();

            t.comment("...after inserting a design document...");

            return Promise.promisify(
                updater
                    .db(db)
                    .newDoc(designDoc1)
                    .id(designDocId)
                    .shouldUpdate((existing, newDoc) => {
                        return !existing.version || existing.version < newDoc.version;
                    })
                    .merge(function (existing, newDoc) {
                        return newDoc;
                    })
                    .update.bind(updater)
            )();
        })
        .then(() => {
            return db.getAsync(designDocId);
        })
        .then((doc) => {
            delete doc._id;
            delete doc._rev;

            t.deepEqual(doc, designDoc1, "...does it equal what was inserted?");
        })
        .then(() => {
            t.comment("...after updating it to a newer version (using the same update logic)...");

            return Promise.promisify(
                updater
                    .newDoc(designDoc2)
                    .update.bind(updater)
            )();
        })
        .then(() => {
            return db.getAsync(designDocId);
        })
        .then((doc) => {
            delete doc._id;
            delete doc._rev;

            t.deepEqual(doc, designDoc2, "...is it actually equivalent to the updated version, as we inserted it?");
        })
        .then(() => {
            t.comment("...after inserting that design document to an arbitrary, different, _id...");

            return Promise.promisify(
                updater
                    .id(otherDocId)
                    .shouldUpdate(null)
                    .merge(null)
                    .update.bind(updater)
            )();
        })
        .then(() => {
            return db.getAsync(otherDocId);
        })
        .then((doc) => {
            delete doc._id;
            delete doc._rev;

            t.deepEqual(doc, designDoc2, "...does that same document exist at this arbitrary, different, _id?");
        })
        .then(() => {
            t.comment("...after removing this new document...");
            return Promise.promisify(
                updater
                    .merge((existing) => {
                        existing._deleted = true;
                        return existing;
                    })
                    .update.bind(updater)
            )();
        })
        .then(() => {
            return db.getAsync(otherDocId)
                .then(() => {
                    t.fail("...a request to fetch the document succeeds.  It should have failed!");
                })
                .catch(NotFoundError, () => {
                    t.pass("...a request to fetch the document fails.  This is expected.");
                });
        })
        .then(() => {
            t.comment("...after removing the original design document...");

            return Promise.promisify(
                updater
                    .id(designDocId)
                    .merge((existing) => {
                        existing._deleted = true;
                        return existing;
                    })
                    .update.bind(updater)
            )();
        })
        .then(() => {
            return db.getAsync(designDocId)
                .then(() => {
                    t.fail("...a request to fetch the document succeeds.  It should have failed!");
                })
                .catch(NotFoundError, () => {
                    t.pass("...a request to fetch the document fails.  This is expected.");
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

function NotFoundError(e) {
    return e && e.error === "not_found";
}
