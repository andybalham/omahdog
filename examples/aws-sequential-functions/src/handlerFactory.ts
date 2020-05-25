import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Lambda } from 'aws-sdk';

import { RequestRouter, HandlerFactory } from './omahdog/FlowContext';
import { ResourceReference, EnvironmentVariable } from './omahdog-aws/SAMTemplate';
import { DynamoDbTableCrudResource, LambdaInvokeResource } from './omahdog-aws/AwsResources';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy, AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy } from './lambdaProxies';

// TODO 04May20: Is there any way we can lazy load these? What is the overhead of them being created for *each* function?

const documentClient = new DynamoDB.DocumentClient();
const lambda = new Lambda();

const resourceNames = {
    flowResultTable: 'FlowResultTable',

    // TODO 25May20: How to get the name of the function resources?
    sumNumbersFunction: 'SumNumbersFunction',
    storeTotalFunction: 'StoreTotalFunction',
    addTwoNumbersFunction: 'AddTwoNumbersFunction',
    addThreeNumbersFunction: 'AddThreeNumbersFunction',
};

const templateReferences = {
    flowResultTable: new ResourceReference(resourceNames.flowResultTable),

    sumNumbersFunction: new ResourceReference(resourceNames.sumNumbersFunction),
    storeTotalFunction: new ResourceReference(resourceNames.storeTotalFunction),
    addTwoNumbersFunction: new ResourceReference(resourceNames.addTwoNumbersFunction),
    addThreeNumbersFunction: new ResourceReference(resourceNames.addThreeNumbersFunction),
};

const environmentVariables = {
    flowResultTableName: new EnvironmentVariable('FLOW_RESULT_TABLE_NAME', templateReferences.flowResultTable),

    sumNumbersFunctionName: new EnvironmentVariable('SUM_NUMBERS_FUNCTION_NAME', templateReferences.sumNumbersFunction),
    storeTotalFunctionName: new EnvironmentVariable('STORE_TOTAL_FUNCTION_NAME', templateReferences.storeTotalFunction),
    addTwoNumbersFunctionName: new EnvironmentVariable('ADD_TWO_NUMBERS_FUNCTION_NAME', templateReferences.addTwoNumbersFunction),
    addThreeNumbersFunctionName: new EnvironmentVariable('ADD_THREE_NUMBERS_FUNCTION_NAME', templateReferences.addThreeNumbersFunction),
};

const resources = {
    flowResultTable: new DynamoDbTableCrudResource(templateReferences.flowResultTable, environmentVariables.flowResultTableName, documentClient),

    sumNumbersFunction: new LambdaInvokeResource(templateReferences.sumNumbersFunction, environmentVariables.sumNumbersFunctionName, lambda),
    storeTotalFunction: new LambdaInvokeResource(templateReferences.storeTotalFunction, environmentVariables.storeTotalFunctionName, lambda),
    addTwoNumbersFunction: new LambdaInvokeResource(templateReferences.addTwoNumbersFunction, environmentVariables.addTwoNumbersFunctionName, lambda),
    addThreeNumbersFunction: new LambdaInvokeResource(templateReferences.addThreeNumbersFunction, environmentVariables.addThreeNumbersFunctionName, lambda),
};

export const handlerFactory = new HandlerFactory()
    .addInitialiser(AddThreeNumbersHandler, handler => {
        handler.totalDescription = 'Three numbers together';
    })
    .addInitialiser(AddTwoNumbersHandler, handler => {
        handler.totalDescription = 'Two numbers together';
    })
    .addInitialiser(StoreTotalHandler, handler => {
        handler.resources.flowResultTable = resources.flowResultTable;
    })
    .addInitialiser(SumNumbersLambdaProxy, handler => {
        handler.resources.proxy = resources.sumNumbersFunction;
    })
    .addInitialiser(StoreTotalLambdaProxy, handler => {
        handler.resources.proxy = resources.storeTotalFunction;
    })
    .addInitialiser(AddTwoNumbersLambdaProxy, handler => {
        handler.resources.proxy = resources.addTwoNumbersFunction;
    })
    .addInitialiser(AddThreeNumbersLambdaProxy, handler => {
        handler.resources.proxy = resources.addThreeNumbersFunction;
    })
    ;
    
    