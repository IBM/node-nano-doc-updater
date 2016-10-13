[![Build Status](https://travis-ci.org/IBM/node-nano-doc-updater.svg?branch=master)](https://travis-ci.org/IBM/node-nano-doc-updater)

# IBM Bluemix DevOps Services - node-nano-doc-updater

For more information on IBM Bluemix DevOps Services, see the [Bluemix Public IDS Experiment](https://new-console.ng.bluemix.net/dashboard/devops).

This is one of hundreds of [IBM Open Source projects at GitHub](http://ibm.github.io).

## Synopsis

```
var db = require("nano")("http://db").db.use("db");
var updater = require("node-nano-doc-updater");

// Migrates a design document.  Will only perform an *upgrade* 
// of an existing design document with a lower version.
//
updater
.db(db)
.existingDoc(null)
.newDoc({ language: "javascript", version: 1 })
.id("_design/foo")
.shouldUpdate((existing, newVer) => {
	return !existing.version || existing.version < newVer.version;
})
.merge((existing, newVer) => {
	return newVer; 
})
.update((err) => { /* handle errors */  });
```

## Description

A module designed to allow updates of CouchDB documents with configurable conflict resolution.

Because of the way CouchbDB handles concurrency, updating a document is non-trivial.  Instead of asking CouchDB to kindly serialize the updates, the process involves determining the current revision of a document and submitting a request to update that particular revision.  In the event other updates have occurred during this process, the request is rejected.

This module emits an object that can perform this tedious and error-prone flow.  Using it involves priming it with information and then asking it to perform one or more updates.

## Creation

### nanoDocUpdater()

Returns a Nano Doc Updater object.  This object holds the parameters of a particular update and can be reused or stored for a later update.

## Setters

The following methods set parameters of an update

### updater.db(db)

Specifies the database to use for the update.  This should be result of [`nano.db.use()`](https://github.com/dscape/nano#nanodbusename) and is required.

### updater.newDoc(doc)

The document to attempt to insert.  This field is required.

### updater&#046;id(id)

The `_id` of the doc to be updated.  This field is required.

### updater.shouldCreate(boolean)

If `true` ensures that during an `updater.update()`, the `newDoc` is inserted even if it doesn't already exist in the DB.  If not specified, `true` is assumed.

### updater.shouldUpdate((publishedDoc, newDoc) => { ... })

Defines a function that is called to determine whether a document should be updated where one already exists in the DB.  This function is given both the `newDoc` and already published documents and should return a boolean indicating wheter an update should be attempted.  Skipping an update in this way results in `updater.update()` ending without error.

If not specified, an update will always be attempted.

### updater.merge((publishedDoc, newDoc) => { ... })

Defines a function that is used to produce a new document, given an existing document and `newDoc`.  Note that `updater` will overwrite the `_rev` field of the resulting document with the revision of the already published document.  Also note that if this function returns an `Error`, no insert will occur.  Instead, `update.update()` will fail with the returned value.  This can be useful for bubbling unrecoverable merge conflicts.  

If not specified, no sophisticated merging will be attempted and `newDoc` will be used, as is.

## Actions

### updater.update((err) => {})

Performs the update and calls the provided callback.

### updater.updateJob()

Returns a function that can be used to perform an update at a later time.  This function will behave exactly like `updater.update()`, however the parameters for the update are immutable and independent of the `updater` object.

## Examples

```
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
```

## License

[The MIT License (MIT)](LICENSE.txt)

## Contributing

Contributions are welcome via Pull Requests. Please submit your very first Pull Request against the [Developer's Certificate of Origin](DCO.txt), adding a line like the following to the end of the file... using your name and email address of course!

```
Signed-off-by: John Doe <john.doe@example.org>
```
