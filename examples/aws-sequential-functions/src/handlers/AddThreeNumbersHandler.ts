import { FlowRequestHandler } from '../omahdog/FlowRequestHandler';
import { FlowBuilder } from '../omahdog/FlowBuilder';
import { FlowDefinition } from '../omahdog/FlowDefinition';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from '../exchanges/AddThreeNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from '../exchanges/SumNumbersExchange';

export class AddThreeNumbersHandler extends FlowRequestHandler<AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersState> {

    flowName = AddThreeNumbersHandler.name;

    constructor() {
        super(AddThreeNumbersResponse, AddThreeNumbersState);
    }

    buildFlow(flowBuilder: FlowBuilder<AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersState>): 
            FlowDefinition<AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersState> {

        return flowBuilder
            .initialise(
                (req, state) => {
                    state.a = req.a;
                    state.b = req.b;
                    state.c = req.c;
                    state.total = 0;
                })

            .perform('Sum_a_and_total', SumNumbersRequest, SumNumbersResponse,
                (req, state) => { req.values = [state.total, state.a]; },
                (res, state) => { state.total = res.total; })

            .perform('Sum_b_and_total', SumNumbersRequest, SumNumbersResponse,
                (req, state) => { req.values = [state.total, state.b]; },
                (res, state) => { state.total = res.total; })

            .perform('Sum_c_and_total', SumNumbersRequest, SumNumbersResponse,
                (req, state) => { req.values = [state.total, state.c]; },
                (res, state) => { state.total = res.total; })

            .finalise(AddThreeNumbersResponse,
                (res, state) => {
                    res.total = state.total;
                });
    }
}

class AddThreeNumbersState {
    a: number;
    b: number;
    c: number;
    total: number;
}
