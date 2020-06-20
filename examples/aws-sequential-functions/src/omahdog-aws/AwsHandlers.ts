import uuid = require('uuid');

import { DynamoDBCrudService } from './AwsServices';

export abstract class DynamoDBCrudHandler {

    services = {
        dynamoDb: new DynamoDBCrudService,
    }

    async put(item: any): Promise<string> {

        item.id = item.id ?? uuid.v4();

        const params: any = {
            TableName: this.services.dynamoDb.tableName,
            Item: item
        };

        await this.services.dynamoDb.client?.put(params).promise();

        return item.id;
    }
}

