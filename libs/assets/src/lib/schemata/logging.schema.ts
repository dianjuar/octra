/*
  ! This file is automatically generated using its json variant. Change only the json file.
*/

  export const OctraLoggingJSONSchema = {
  'properties': {
    'version': {
      'type': 'string'
    },
    'encoding': {
      'type': 'string'
    },
    'projectname': {
      'type': 'string'
    },
    'logs': {
      'items': {
        'type': 'object',
        'properties': {
          'timestamp': {
            'type': 'integer'
          },
          'type': {
            'type': 'string'
          },
          'target': {
            'type': 'string'
          },
          'value': {
            'type': [
              'string',
              'integer',
              'object'
            ]
          },
          'playpos': {
            'type': 'integer'
          },
          'caretpos': {
            'type': 'integer'
          }
        }
      },
      'type': 'array'
    },
    'additionalProperties': false
  }
}
;