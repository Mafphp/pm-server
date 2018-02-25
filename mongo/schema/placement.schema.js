const Schema = require('mongoose').Schema;
const PlacementInfoSchema = require('./placement_info.schema');

let schema_obj = {
  component_name: String, // menu, main, slider, ...
  variable_name: String, // sub component
  start_date: Date, // for scheduling
  end_date: Date,
  info: PlacementInfoSchema,
};

let PlacementSchema = new Schema(schema_obj, {collection: 'placement', strict: true});
module.exports = PlacementSchema;