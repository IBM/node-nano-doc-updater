module.exports = function omit(source/*, blacklist1, blacklist2, blacklist3 */) {
    var result = {};

    var blacklist = Array.prototype.slice.call(arguments, 1);
    
    Object.getOwnPropertyNames(source).forEach(function (e) {
        if (blacklist.indexOf(e) === -1)
            result[e] = source[e];
    });

    return result;
};
