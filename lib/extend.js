/* Shallow object copy. */
module.exports = function (target /*, sources ... */) {
        for (var i=1; i<arguments.length; i++) {
            var source = arguments[i];

            Object.getOwnPropertyNames(source).forEach(function (e) {
                    target[e] = source[e];
            });
        }
	return target;
};
