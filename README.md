NAME
----

nano-doc-updater - Updates couchdb documents with configurable conflict resolution


DESCRIPTION
-----------

Because of the way CoucbDB handles concurrency, updating a document is non-trivial.
Instead of asking CouchDB to kindly serialize the updates, the process is:

- Ask CouchDB for the current revision of the doc.
- If it doesn't exist, try to insert the new version of the doc.
- If the doc did exist, at the very least, take the _rev of the existing doc
  and apply it to the new doc.  Potentially merge the new doc with the existing
  doc.
- Perform the insert of the new and improved doc.
- If someone else slipped an insert in (i.e. if the _rev of the doc fetched above is
  no longer the latest), basically try all of this again.
- Rinse and repeat until either a catastrophic error occurs, or an insert works.

This module emits an object that can perform this tedious and error-prone
flow.  Using it involves priming it with information and then asking it
perform one or more updates.  The primed information includes the following
paramters.


PARAMETERS
----------

Note that parameters are specified by running setter functions.  Each setter returns the nano-doc-updater, so these calls may be chained.

- `.db(db)` - Specify a nano db object.
- `.existingDoc(doc)` - The published revision of the document, if it has already been fetched.
- `.newDoc(doc)` - The revision of the document we'd like to publish.
- `.id(id)` - The ID of the doc to update.
- `.shouldCreate(boolean)` - Determines whether a document should be created when no document exists.  Defaults to true.  Where this is false, newDoc needn't be defined (unless the second argument to `shouldUpdate()` or `merge()` is actually used).
- `.shouldUpdate(function (publshedVer, newVer) { ... })` - Called where an existing document exists at the given ID. Should return true iff an insert should occur.  If not provided, the insert will always happen.
- `.merge(function (publishedVer, newDoc) { ... })` - Where the function provided to shouldUpdate() returns the affirmative, this function is run against the published and new versions of the document.  This should return a merged version of the two documents.  If this function is not provided, the document provided to newDoc() will be used verbatim.  NOTE: That the _rev of the published revision will always be applied to the document inserted, after the merge.  NOTE ALSO: That if this function returns a non-object, or an Error, no insert will occur.  Instead, update() will fail with the returned value.  This behavior can be useful for detecting and handling unrecoverable merge conflicts.


ACTIONS
-------

After priming a nano-doc-updater with the functions above, to have it actually perform an update, call `.update(function (err) {})`.  This is a standard async function that will return on error or after the updating has finally completed.

To get a function that can be run later to perform the primed update, run `.updateJob()`.  This will return an asynchronous function that will work just like `.update()`, but will always use the options present at the time it's called.  This is handy if you want to create a bunch of jobs and send them all to a flow control library like `async`.

Both of these function `.update()` and the async function returned by `.updateJob()` will return either an error or the published revision of the indicated document.


USAGE
-----

	var updater = require("nano-doc-updater");
	var db = require("nano")("https://mydatabase.com").use("mydatabase");

	/* Update a design document */
	updater
	.db(db)
	.existingDoc(null) // If you happened to already fetch the current revision, provide it here.  Otherwise it will be fetched first.
	.newDoc({
		language: "javascript",
		version: 1
	})
	.id("_design/foo")
	.shouldUpdate(function (existing, newVer) {
		/* For a versioned design document, there are some times where
		   in the face of an existing document, we don't want to update. 
		   Namely, when the published version is at or above the level
		   we were about to publish. */
		return !existing.version || existing.version < newVer.version;
	})
	.merge(function (existing, newVer) {
		return newVer; 
		// to ensure this process eventually terminates, 
		// nano-doc-updater will bump the _rev for us.
	})
	.update(function (err) {
		if (err)
			process.exit(1);

		/* Reuse the same updater to perform another design update. */
		updater
		.newDoc({
			language: "javascript",
			version: 2,
			_views: {
				count: {
					map: function (d) {
						emit(null, 1);
					},
					reduce: function (k, v, r) {
						sum(v);
					}
				}
			}
		})
		.update(function (err) {
			/* Reuse the same updater to update some other unrelated doc with that design above. */
			updater
			.id("foo")
			.shouldUpdate(null) // the default: always try to update
			.merge(null) 	    // the default: overwrite the existing document
			.update(function (err) {
				if (err)
					process.exit(1);

				/* Delete that document. */
				updater
				.shouldCreate(false)
				.merge(function (published) {
					var r = {};
					Object.getOwnPropertyNames(published).forEach(function (p) {
						r[p] = published[p];
					});
					return r;
				})
				.update(function (err) {
					if (err)
						process.exit(1);

					console.log("All done!");
				});
			})
		});
	});



	/* Or use Async for flow control and avoid all those indents. */
	var async = require("async");

	async.series([
		/* JOB1: Update or create a design document. */
		updater
		.db(db)
		.existingDoc(null)
		.newDoc({
			language: "javascript",
			version: 1
		})
		.id("_design/foo")
		.shouldUpdate(function (existing, newVer) {
			return !existing.version || existing.version < newVer.version;
		})
		.merge(function (existing, newVer) {
			var clone = {};
			Object.getOwnProperyNames(newVer).forEach(function (p) {
				clone[p] = newVer[p];
			});
			clone._rev = existing._rev;

			# This is actually the default behavior :-)
		})
		.updateJob(),

		/* JOB2: Update the same design document again. */
		updater
		.newDoc({
			language: "javascript",
			version: 2,
			_views: {
				count: {
					map: function (d) {
						emit(null, 1);
					},
					reduce: function (k, v, r) {
						sum(v);
					}
				}
			}
		})
		.updateJob(),

		/* JOB3: Update or create some other document in the same db. */
		updater
		.id("foo")
		.shouldUpdate(null) // use default: always replace existing doc.
		.merge(null) // use default: no fancy merge.  just bump the _rev and insert.
		.updateJob(),

		/* JOB4: Delete the document we just created. */
		updater
		.shouldCreate(false)
		.merge(function (published) {
			var r = {};
			Object.getOwnPropertyNames(published).forEach(function (p) {
				r[p] = published[p];
			});

			r._deleted = true;
			return r;
		}).updateJob()

		// The DB will behave as though the document doesn't exist, so recreating
		// would be a matter of running JOB3 again.
	], function (err, r) {
		console.log("All done");
	});


BUGS
----

- This doc's a bit terse.  Also, I haven't actually tested the example :-)
- This module is only sorta useful where documents are being accessed from a view.  In these situations, the user would have to look up the document from outside of this module, then ask this module to update the document.


AUTHOR
------

Chris Taylor <cntaylor@ca.ibm.com>