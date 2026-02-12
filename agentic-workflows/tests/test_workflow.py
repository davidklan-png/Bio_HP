from agent import TaskState, execute_plan, finalize_response, plan_task, review_outputs


def test_workflow_generates_plan_and_output() -> None:
    state = TaskState(task="Test task", model="codex-5.3")
    state = plan_task(state)
    state = execute_plan(state)
    state = review_outputs(state)
    result = finalize_response(state)

    assert result["plan"], "Plan should not be empty"
    assert result["tool_outputs"], "Tool outputs should not be empty"
    assert "final_recommendation" in result
