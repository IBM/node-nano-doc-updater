var test = require("tape-catch"),
    Promise = require("bluebird"),
    resetTestDb = require("./lib/reset-test-db");

test("after execiting the steps in the Synopsis section" + 
     "the README (insert a design document with custom)" +
     "update criteria...", (t) => {
    var db = null;
    var designDocId = "_design/foo";
    var designDoc = { language: "javascript", version: 1 };

    resetTestDb()
    .then((rawDb) => {
        db = Promise.promisifyAll(rawDb);
        return Promise.promisify(synopsisFlow)(db, designDocId, designDoc);
    })
    .then(() => {
        return db.getAsync(designDocId);
    })
    .then((doc) => {
        delete doc._id;
        delete doc._rev;

        t.deepEquals(doc, designDoc, "...and after fetching the design document manually, does it match what we inserted?");
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

function synopsisFlow(db, designDocId, designDoc, callback) {
    var nanoDocUpdater = require("../../");
    var updater = nanoDocUpdater(db);

    updater
    .db(db)
    .existingDoc(null)
    .newDoc(designDoc)
    .id(designDocId)
    .shouldUpdate((existing, newDoc) => {
        return !existing.version || existing.version < newDoc.version;
    })
    .merge((existing, newDoc) => {
        return newDoc;
    })
    .update(callback);
}
