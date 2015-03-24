"use strict";

/*
 * Performs an insert/update on a CouchDB document.  Where a document
 * with the provided ID already exists, optionally runs user defined
 * functions for either skipping an update (based on the existing document)
 * or merging.
 * 
 */

module.exports = function () {
	return new NanoDocUpdater();
};

function NanoDocUpdater () {
	this._db = null;
	this._existingDoc = null;
	this._newDoc = null;
	this._shouldUpdate = null;
	this._merge = null;
	this._id = null;
	this._shouldCreate = true;
}

(function () {
	["db", "existingDoc", "newDoc", "id", "shouldUpdate", "shouldCreate", "merge"].forEach(function (f) {
		NanoDocUpdater.prototype[f] = function (newValue) {
			this["_" + f] = newValue;
			return this;
		};
	}.bind(this));

	NanoDocUpdater.prototype.update = function (callback) {
		updateDocument(
			this._existingDoc, 
			this._newDoc, 
			this._id,
			this._db, 
			this._shouldUpdate, 
			this._shouldCreate,
			this._merge, 
			callback
		);
	};

	NanoDocUpdater.prototype.updateJob = function () {
		var existingDoc = this._existingDoc;
		var newDoc = this._newDoc;
		var id = this._id;
		var db = this._db;
		var shouldUpdate = this._shouldUpdate;
		var shouldCreate = this._shouldCreate;
		var merge = this._merge;

		return function (callback) {
			updateDocument(
				existingDoc, 
				newDoc, 
				id,
				db, 
				shouldUpdate, 
				shouldCreate,
				merge, 
				callback
			);
		};
	};
}());


/* Says ``always do something'' */
function always(/*existing, newVer*/) {
	return true;
}

/* Given two documents (an existing one and a new one) returns a new one.
 */
function useNewVersion(existing, newVer) {
	return newVer;
}

/* Shallow object copy. */
function extend(target, source) {
	Object.getOwnPropertyNames(source).forEach(function (e) {
		target[e] = source[e];
	});
	return target;
}

function omit(source, blacklist) {
	var result = {};

	Object.getOwnPropertyNames(source).forEach(function (e) {
		if (blacklist.indexOf(e) === -1)
			result[e] = source[e];
	});

	return result;
}

/* Create-or-update a document: First fetch the existing revision, then 
   insert a new one.  Optional f_ShouldUpdate and f_Merge functions
   control the specifics of merging. */
function updateDocument(existingDoc, newDoc, id, db, f_ShouldUpdate, shouldCreate, f_Merge, callback) {
	if (!f_ShouldUpdate) {
		f_ShouldUpdate = always;
	}

	if (!f_Merge) {
		f_Merge = useNewVersion;
	}

	// If we never grabbed the existing document from the DB, fetch it and try again.
	if (!existingDoc) {
		return db.get(id, function (err, r) {
			// If the fetch came back with nothing, attempt to do a fresh insert unless the user
			// doesn't want documents to be created.
			if (err && (err.error === "not_found")) {
				if (!shouldCreate)
					// Don't create a document where one didn't exist, if the user so desires.
					return callback(null, null);

				return db.insert(newDoc, id, function (err, r) {
					// If someone beat us here, we should retry this whole operation.
					if (err && err.error === "conflict")
						return updateDocument(null, newDoc, id, db, f_ShouldUpdate, shouldCreate, f_Merge, callback);

					// If anything else happened, we should bail.
					if (err)
						return callback("Could not fetch existing document: " + err.toString());

					// The insert worked.  We're done.
					return callback(null, extend({_rev: r.rev}, newDoc));
				});
			}

			// If the fetch came back with any other error, bail.
			if (err)
				return callback("Could not fetch existing document: " + err.toString());

			// We got the document.  Let's try the update again.
			return updateDocument(r, newDoc, id, db, f_ShouldUpdate, shouldCreate, f_Merge, callback);
		});
	}

	if (!f_ShouldUpdate(existingDoc, newDoc)) {
		return callback(null, existingDoc);
	}

	// Before merging, record that we want to undelete a document that has been deleted.
	var mergedDoc = f_Merge(omit(existingDoc, "_deleted"), newDoc);
	if (!mergedDoc || typeof mergedDoc !== "object" || mergedDoc instanceof Error) {
		// Allow a user defined merge algorithm to say ``sorry...can't merge'' by returning a non-object or Error.
		// Bubble this error, so that the user can then test for it in their callback.
		return callback(mergedDoc);
	}

	// It's essential that we specify a revision or this will never terminate.
	// It's probably not a good idea to trust a user-specified merge function to do this.
	mergedDoc = extend({ _rev: existingDoc._rev }, mergedDoc);

	// The document exists, and is out of date.  We need to overwrite it.
	db.insert(
		mergedDoc,
		id,
		function (err/*, r*/) {
			// If someone beat us here, we need to try the whole thing again.
			if (err && err.error === "conflict")
				return updateDocument(null, newDoc, newDoc, db, f_ShouldUpdate, f_Merge, callback);

			// If anything else happened, bail.
			if (err)
				return callback("Could not update the document to the proposed version: " + err.toString());

			// The replacement worked.  We're done.  Finally!
			return callback(null, mergedDoc);
		}
	);
}