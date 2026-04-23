
const submitTask = async () => {
    const response = await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: "What is the capital of France",
            budget: 0.30
        })
    });
    const data = await response.json();
    console.log('Task submitted:', data);
    return data.id;
};

submitTask();
