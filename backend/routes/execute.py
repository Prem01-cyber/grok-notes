from fastapi import APIRouter, HTTPException
import subprocess
import tempfile
import os

router = APIRouter()

@router.post("/python")
async def execute_python(request: dict):
    code = request.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    try:
        # Create a temporary file to store the code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file_name = f.name

        # Execute the code with a timeout of 10 seconds
        result = subprocess.run(
            ['python', temp_file_name],
            capture_output=True, text=True, timeout=10
        )

        # Remove the temporary file
        os.unlink(temp_file_name)

        # Return the output or error
        if result.returncode == 0:
            return {"output": result.stdout}
        else:
            return {"error": result.stderr}
    except subprocess.TimeoutExpired:
        return {"error": "Code execution timed out after 10 seconds"}
    except Exception as e:
        return {"error": str(e)}
