import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';
import { PutItemInput, PutItemOutput } from 'aws-sdk/clients/dynamodb';
import { expect } from 'chai';
import { FlowContext } from '../src/omahdog/FlowContext';
import { StoreTotalRequest } from '../src/exchanges/StoreTotalExchange';
import { StoreTotalHandler } from '../src/handlers/StoreTotalHandler';

describe('StoreTotalHandler tests', () => {

    it('Can have AWS service mocked', async () => {
        
        const expectedTableName = 'TableName';

        const request: StoreTotalRequest = {
            description: 'description',
            total: 666,
            startTime: new Date,
            endTime: new Date
        };

        AWSMock.setSDKInstance(AWS);
        
        AWSMock.mock('DynamoDB.DocumentClient', 'put', (params: PutItemInput, callback: Function) => {

            expect(params.TableName).to.equal(expectedTableName);
            expect(params.Item.result).to.deep.equal(request);

            const output: PutItemOutput = {};
            callback(null, output);
        });

        const client = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

        const response = await new StoreTotalHandler(client, expectedTableName).handle(FlowContext.newContext(), request);

        expect(response).to.not.be.undefined;

        AWSMock.restore('DynamoDB.DocumentClient');
    });
});