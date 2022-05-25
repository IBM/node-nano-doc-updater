/**
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2015, 2016. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 */
"use strict";

/*
 * Performs an insert/update on a CouchDB document.  Where a document
 * with the provided ID already exists, optionally runs user defined
 * functions for either skipping an update (based on the existing document)
 * or merging.
 *
 */

var cloudant = require('@otc-core/cloudant'),
    extend = require("./lib/extend"),
    omit = require("./lib/omit");

module.exports = function () {
    return new NanoDocUpdater();
};

function NanoDocUpdater () {
    this._cloudantService = null;
    this._dbName = null;
    this._isDesignDoc = null;
    this._existingDoc = null;
    this._newDoc = null;
    this._shouldUpdate = null;
    this._merge = null;
    this._id = null;
    this._shouldCreate = true;
}

(function () {
    ["cloudantService", "dbName", "isDesignDoc", "existingDoc", "newDoc", "id", "shouldUpdate", "shouldCreate", "merge"].forEach(function (f) {
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
            this._cloudantService,
            this._dbName,
            this._isDesignDoc,
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
        var cloudantService = this._cloudantService;
        var dbName = this._dbName;
        var isDesignDoc = this._isDesignDoc;
        var shouldUpdate = this._shouldUpdate;
        var shouldCreate = this._shouldCreate;
        var merge = this._merge;

        return function (callback) {
            updateDocument(
                existingDoc,
                newDoc,
                id,
                cloudantService,
                dbName,
                isDesignDoc,
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


/* Create-or-update a document: First fetch the existing revision, then
   insert a new one.  Optional f_ShouldUpdate and f_Merge functions
   control the specifics of merging. */
async function updateDocument(existingDoc, newDoc, id, cloudantService, dbName, isDesignDoc, f_ShouldUpdate, shouldCreate, f_Merge, callback) {
    if (!f_ShouldUpdate) {
        f_ShouldUpdate = always;
    }

    if (!f_Merge) {
        f_Merge = useNewVersion;
    }

    // If we never grabbed the existing document from the DB, fetch it and try again.
    if (!existingDoc) {
    	var fn = isDesignDoc ? cloudant.getDesignDocument : cloudant.getDocument;
        var r = await fn(cloudantService, dbName, id)
            .catch(async function(err) {
	            if (err.message === "not_found") {
	                if (!shouldCreate) {
                        // Don't create a document where one didn't exist, if the user so desires.
                        return callback(null, null);
                    }

			        fn = isDesignDoc ? cloudant.createDesignDocument : cloudant.createDocument;
			        var r2 = await fn(cloudantService, dbName, id, newDoc)
			            .catch(function(err) {
			            	// If someone beat us here, we should retry this whole operation.
				            if (err.message === "conflict") {
				            	return updateDocument(null, newDoc, id, cloudantService, dbName, isDesignDoc, f_ShouldUpdate, shouldCreate, f_Merge, callback);
			            	}

			                // If anything else happened, we should bail.
			                return callback("Could not fetch existing document: " + err.toString());
			        	})
			        if (!r2) {
			            return; /* handled in the catch above */
			        }

			        // The insert worked.  We're done.
			        return callback(null, extend({}, newDoc, {_rev: r2.rev}));
		        }

	            // If the fetch came back with any other error, bail.
	            return callback("Could not fetch existing document: " + err.toString());
            })
        if (!r) {
            return; /* handled in the catch above */
        }

        // We got the document.  Let's try the update again.
        return updateDocument(r, newDoc, id, cloudantService, dbName, isDesignDoc, f_ShouldUpdate, shouldCreate, f_Merge, callback);
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
    mergedDoc = extend({}, mergedDoc, { _rev: existingDoc._rev });

    // The document exists, and is out of date.  We need to overwrite it.
    fn = isDesignDocument ? cloudant.updateDesignDocument : cloudant.updateDocument;
    var result = await fn(cloudantService, dbName, id, mergedDoc)
        .catch(function(err) {
            // If someone beat us here, we need to try the whole thing again.
            if (err.message === "conflict") {
                return updateDocument(null, newDoc, id, cloudantService, dbName, isDesignDoc, f_ShouldUpdate, shouldCreate, f_Merge, callback);
            }

            // If anything else happened, bail.
            return callback("Could not update the document to the proposed version: " + err.toString());
        })

    if (result) {
	    // Update the new document's _rev
	    mergedDoc._rev = result.rev;
	
	    // The replacement worked.  We're done.  Finally!
	    return callback(null, mergedDoc);
    }
}
