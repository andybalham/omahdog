import uuid = require('uuid');

import { DynamoDBCrudService } from './AwsServices';
import { throwErrorIfInvalid } from './SAMTemplate';

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

    throwErrorIfInvalid(getPrefix: () => string): void {
        throwErrorIfInvalid(this, getPrefix);
    }
}

