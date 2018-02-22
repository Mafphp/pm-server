const Base = require('./base.model');
// const error = require('./errors.list');
// const mongoose = require('mongoose');

class Tag extends Base {

    constructor(test = Tag.test) {

        super('Tag', test);

        this.TagModel = this.model;
    }

    suggest(phrase) {
        return this.TagModel.aggregate([
            {$match: {
                name: {$regex: phrase, $options: 'i'}
            }}
        ]).limit(5).sort({name: 1});
    }
}

Tag.test = false;

module.exports = Tag;