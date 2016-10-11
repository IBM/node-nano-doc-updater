var test = require("tape-catch"),
    Promise = require("bluebird"),
    nano = require("nano"),
    nanoDocUpdater = require("../");

test("sanity - after wiping the DB...", (t) => {
    resetTestDB()
    .then((db) => {
        db = Promise.promisifyAll(db);
        return db.listAsync();
    })
    .then((r) => {
        var body = r[0];

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

test("after updating a document that didn't already exist...", (t) => {
    var db = null;
    var docId = "a";
    var doc = { a: 1 };

    resetTestDB()
    .then((rawDb) => {
        db = Promise.promisifyAll(rawDb);

        var updater = nanoDocUpdater()
        .db(rawDb)
        .newDoc(doc)
        .id(docId);

        return Promise.promisify(updater.update, updater)();
    })
    .then(() => {
        return db.getAsync(docId);
    })
    .then((r) => {
        var d = r[0];

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

// Returns a Promise that resolves with a handle to a blank testing DB.
function resetTestDB() {
    var DB_NAME = "test",
        n = null;

    return Promise.try(() => {
        if (!process.env.DB) {
            throw new Error("DB envvar is undefinied");
        }

        n = nano(process.env.DB);
        return Promise.promisify(n.db.destroy)("test");
    })
    .catch(NanoNotFoundError, (e) => {})
    .then(() => {
        return Promise.promisify(n.db.create)("test");
    })
    .then(() => {
        return n.use(DB_NAME);
    });
}

// Returns true iff the provided error is a Nano "Not Found" error.
function NanoNotFoundError(e) {
    return e && e.error == "not_found";
} 
