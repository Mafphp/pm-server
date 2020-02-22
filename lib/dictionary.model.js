
const Base = require('./base.model');
const error = require('./errors.list');
const mongoose = require('mongoose');

class Dictionary extends Base {

  constructor(test = Dictionary.test) {

    super('Dictionary', test);

    this.DictionaryModel = this.model;
  } 

  getDictionaries() {
    // return this.DictionaryModel.find();
  }
 
  updateDictionary(DictionaryId, body) {
    if (!body['name'])
      return Promise.reject(error.dictionaryNameRequired);

    if (!body['value'])
      return Promise.reject(error.dictionaryValueRequired);

    if (!body['type'])
      return Promise.reject(error.dictionaryTypeRequired);

    if (!mongoose.Types.ObjectId.isValid(DictionaryId))
      return Promise.reject(error.invalidDictionary);
    let params = {
      "name": body.name,
      "value": body.value,
      "type": body.type
    };
    return this.DictionaryModel.findByIdAndUpdate(DictionaryId, params);
  }

  removeDictionary(DictionaryId) {
    if (!mongoose.Types.ObjectId.isValid(DictionaryId)) {
      return Promise.reject(error.invalidDictionary);
    }
    return this.DictionaryModel.findByIdAndRemove(DictionaryId);
  }

  addDictionary(body) {
    if (!body['name'])
      return Promise.reject(error.dictionaryNameRequired);

    if (!body['value'])
      return Promise.reject(error.dictionaryValueRequired);

    if (!body['type'])
      return Promise.reject(error.dictionaryTypeRequired);

    let params = {
      "name": body.name,
      "value": body.value,
      "type": body.type
    };
    return new Promise((resolve, reject) => {
      this.DictionaryModel.create(params).then(() => {
        resolve();
      }).catch(err => {
        reject(error.duplicateDictionary);
      });
    })
  }

}

Dictionary.test = false;

module.exports = Dictionary;