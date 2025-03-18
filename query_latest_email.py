from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database connection
db_url = "postgresql://postgres:password@localhost:5432/emailbot"
engine = create_engine(db_url)
Session = sessionmaker(bind=engine)
session = Session()

# Query the latest email for user 1
result = session.execute(
    text("SELECT * FROM email_metadata WHERE user_id = 1 ORDER BY date DESC LIMIT 1")
)
row = result.fetchone()

if row:
    # Print the columns and values
    for column, value in zip(result.keys(), row):
        print(f"{column}: {value}")
else:
    print("No emails found for user 1")

session.close()
