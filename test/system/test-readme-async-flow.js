var test = require("tape-catch"),
    Promise = require("bluebird"),
    nanoDocUpdater = require("../../"),
    resetTestDb = require("./lib/reset-test-db"),
    async = require("async");

test("after running through the 'async' flow from the README...", (t) => {
    var db = null;
    var designDocId = "_design/foo";
    var arbitraryDocId = "foo";

    resetTestDb()
    .then((rawDb) => {
        db = Promise.promisifyAll(rawDb);

        var updater = nanoDocUpdater()
        .db(rawDb);

        return Promise.promisify(readmeAsyncFlow)(rawDb, updater, designDocId, arbitraryDocId);
    })
    .then(() => {
        t.pass("...it at least succeeded");

        return Promise.promisify(db.getAsync)(designDocId)
        .then(() => {
            t.fail("...the design doc inserted in the sample code still exists (i.e. was not deleted)");
        })
        .catch(NotFoundError, () => {
            t.pass("...the design doc inserted in the sample code was removed (as expected)");
        });
    })
    .then(() => {
        return Promise.promisify(db.getAsync)(arbitraryDocId)
        .then(() => {
            t.fail("...the arbitrary doc inserted in the sample code still exists (i.e. was not deleted)");
        })
        .catch(NotFoundError, () => {
            t.pass("...the arbitrary doc inserted in the sample code was removed (as expected)");
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

function readmeAsyncFlow(db, updater, designDocId, arbitraryDocId, callback) {
    async.series([
        // Add a design document.  Only publish this if the in-db version is
        // lower.
        updater.db(db).id(designDocId).newDoc({
            language: "javascript",
            version: 1
        })
        .shouldUpdate((existing, newDoc) => {
            return !existing.version || existing.version < newDoc.version;
        })
        .updateJob(),


        // Update the design document with an even newer version,
        // but, again, only if it's out of date.
        updater.db(db).id(designDocId).newDoc({
            language: "javascript",
            version: 2,
            views: {
                count: {
                    map: "function (d) { emit(null, 1); }",
                    reduce: "function (k, v, r) { sum(v); }"
                }
            }
        })
        .updateJob(),


        // Place that same document somewhere else in the db:
        updater.shouldUpdate(null).merge(null).id(arbitraryDocId).updateJob(),

        // Delete that document:
        updater
        .merge((existing) => {
            existing._deleted = true;
            return existing;
        })
        .updateJob(),

        // Delete the design document:
        updater
        .id(designDocId)
        .updateJob()
    ], callback);
}

function NotFoundError(e) {
    return e && e.error === "not_found";
}
