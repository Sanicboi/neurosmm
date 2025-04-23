from dotenv import load_dotenv
import asyncio
from heygen import HeyGen
load_dotenv()



async def main():
    heygen = HeyGen()



if __name__ == "__main__":
    asyncio.run(main())