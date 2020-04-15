import { expect } from 'chai';
import { IActivityRequestHandler, FlowHandlers } from '../src/FlowHandlers';
import { FlowContext } from '../src/FlowContext';

class ExampleActivityRequest {
    input: number;
}

class ExampleActivityResponse {
    output: number;
}

class ExampleHandler implements IActivityRequestHandler<ExampleActivityRequest, ExampleActivityResponse> {
    async handle(_flowContext: FlowContext, request: ExampleActivityRequest): Promise<ExampleActivityResponse> {
        return { output: request.input };
    }
}

describe('Handlers', () => {

    it('Handlers can send request to handler', async () => {

        const handlers = new FlowHandlers();
        handlers.register(ExampleActivityRequest, ExampleActivityResponse, new ExampleHandler());

        const request = new ExampleActivityRequest();
        request.input = 616;

        const response =
            await handlers.sendRequest(new FlowContext(), ExampleActivityRequest, request) as ExampleActivityResponse;

        expect(response).to.be.not.null;
        expect(response.output).to.be.equal(request.input);
    });

    it('Flow can be built', () => {

        // const flowBuilder = new FlowBuilder<ExampleFlowState>();

        // flowBuilder
        //     .start(ExampleFlowRequest,
        //         (req, state) => { state.value = req.input; })

        //     .perform("MyActivity", ExampleActivityRequest, ExampleActivityResponse,
        //         (req, state) => { req.input = state.value; },
        //         (res, state) => { state.value = res.output; })

        //     .switchOn("Input number", state => state.value,
        //         when => when
        //             .equal(653).goto("Summat")
        //             .true(value => value > 200).continue())
        //     .else().continue()

        //     .end(ExampleFlowResponse,
        //         (res, state) => { res.output = state.value; })
        //     ;
    });
});