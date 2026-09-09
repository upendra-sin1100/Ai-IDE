import pytest
from app.services.docker_execution_service import DockerExecutionService


def test_docker_language_config_java_public_class():
    code = """
    package com.example;

    public class CustomCalculator {
        public static void main(String[] args) {
            System.out.println("Hello World");
        }
    }
    """
    # Create service without checking docker CLI availability
    service = DockerExecutionService.__new__(DockerExecutionService)
    image, target_file, command = service._language_config("java", "Main.java", code=code)

    assert target_file == "CustomCalculator.java"


def test_docker_language_config_java_fallback_filename():
    code = """
    class SimpleApp {
        public static void main(String[] args) {
            System.out.println("No public class");
        }
    }
    """
    service = DockerExecutionService.__new__(DockerExecutionService)
    image, target_file, command = service._language_config("java", "MyRunner.java", code=code)

    assert target_file == "MyRunner.java"


def test_docker_language_config_java_fallback_default():
    code = """
    class SimpleApp {}
    """
    service = DockerExecutionService.__new__(DockerExecutionService)
    image, target_file, command = service._language_config("java", "script.txt", code=code)

    assert target_file == "Main.java"
