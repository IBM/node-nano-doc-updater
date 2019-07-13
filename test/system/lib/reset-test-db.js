var nano = require("nano"),
    Promise = require("bluebird");

// Returns a Promise that resolves with a handle to a blank testing DB.
module.exports = function resetTestDB() {
    var DB_NAME = "test",
        n = null;

    return Promise.try(() => {
        if (!process.env.DB) {
            throw new Error("DB envvar is undefined");
        }

        n = nano(process.env.DB);
        return Promise.promisify(n.db.destroy)("test");
    })
        .catch(NanoNotFoundError, () => {})
        .then(() => {
            return Promise.promisify(n.db.create)("test");
        })
        .then(() => {
            return n.use(DB_NAME);
        });
};

// Returns true iff the provided error is a Nano "Not Found" error.
function NanoNotFoundError(e) {
    return e && e.error == "not_found";
} 
