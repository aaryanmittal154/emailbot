"""
Database utility class for executing queries directly
"""
from sqlalchemy import text
from app.db.database import engine


class Database:
    """Database utility for direct query execution"""
    
    def __init__(self):
        """Initialize database connection"""
        self.engine = engine
    
    def execute_query(self, query_str, params=None):
        """
        Execute a raw SQL query with parameters
        
        Args:
            query_str: SQL query string
            params: Parameter dictionary for the query
            
        Returns:
            Query results
        """
        with self.engine.connect() as connection:
            if params:
                result = connection.execute(text(query_str), params)
            else:
                result = connection.execute(text(query_str))
                
            if result.returns_rows:
                # Convert to list of dictionaries
                columns = result.keys()
                return [dict(zip(columns, row)) for row in result.fetchall()]
            return []
    
    def execute_many(self, query_str, params_list):
        """
        Execute a batch SQL query with multiple parameter sets
        
        Args:
            query_str: SQL query string
            params_list: List of parameter dictionaries
            
        Returns:
            Success status
        """
        try:
            with self.engine.connect() as connection:
                connection.execute(text(query_str), params_list)
            return True
        except Exception as e:
            print(f"Database execution error: {str(e)}")
            return False
    
    def query_one(self, query_str, params=None):
        """
        Execute a query and return the first result row
        
        Args:
            query_str: SQL query string
            params: Parameter list or dictionary for the query
            
        Returns:
            First row as dictionary or None if no results
        """
        with self.engine.connect() as connection:
            if params:
                result = connection.execute(text(query_str), params)
            else:
                result = connection.execute(text(query_str))
                
            if result.returns_rows:
                row = result.fetchone()
                if row:
                    return dict(zip(result.keys(), row))
            return None
            
    def execute(self, query, params=None):
        """
        Execute a query with parameters (compatibility method for SQLAlchemy Session interface)
        
        Args:
            query: SQL query (text object or string)
            params: Parameter dictionary for the query
            
        Returns:
            Query result
        """
        if not isinstance(query, text):
            query = text(str(query))
            
        with self.engine.connect() as connection:
            result = connection.execute(query, params)
            connection.commit()
            return result
            
    def commit(self):
        """
        Commit transaction (compatibility method for SQLAlchemy Session interface)
        This is a no-op as commits are handled in execute method
        """
        pass
        
    def rollback(self):
        """
        Rollback transaction (compatibility method for SQLAlchemy Session interface)
        This is a no-op as rollbacks are handled in execute method on exception
        """
        pass
        
    def close(self):
        """
        Close connection (compatibility method for SQLAlchemy Session interface)
        This is a no-op as connections are managed by context managers
        """
        pass
