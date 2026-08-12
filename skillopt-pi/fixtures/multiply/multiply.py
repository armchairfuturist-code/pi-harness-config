#!/usr/bin/env python3
def multiply(a, b):
    return a + b  # BUG: should be a * b

if __name__ == "__main__":
    import sys
    a, b = int(sys.argv[1]), int(sys.argv[2])
    print(multiply(a, b))
