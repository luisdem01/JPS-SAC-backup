import sys
import argparse
import json
import csv
import io
import logging
import asyncio
from renacyt_connector.api import RenacytConnector, RenacytError

def configure_logging(verbose):
    """Sets up the console log level based on verbosity flag."""
    level = logging.INFO if verbose else logging.WARNING
    # Clean default logging setup
    logging.basicConfig(
        level=level,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        stream=sys.stderr
    )

def records_to_csv(records):
    """Serializes normalized researcher records into CSV string (excluding the '_raw' key)."""
    if not records:
        return ""
        
    # Get all keys from the first record excluding '_raw'
    sample = records[0]
    headers = [key for key in sample.keys() if key != '_raw']
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers, lineterminator='\n')
    writer.writeheader()
    
    for record in records:
        # Create a copy of the dictionary without the '_raw' key
        row = {key: record.get(key) for key in headers}
        writer.writerow(row)
        
    return output.getvalue()

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

    parser = argparse.ArgumentParser(
        description="RENACYT Connector - Command Line Interface for querying the Peruvian researchers database."
    )
    
    # Search Filter Group
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('-d', '--dni', type=str, help="Query researcher by DNI / Passport number (exact match).")
    group.add_argument('-o', '--orcid', type=str, help="Query researcher by ORCID identifier (exact match).")
    group.add_argument('-c', '--code', type=str, help="Query researcher by RENACYT registration code (exact match).")
    group.add_argument('-n', '--name', type=str, help="Query researchers by full/partial name (ilike match).")
    group.add_argument('-a', '--lastname', type=str, help="Query researchers by last name (ilike match).")
    group.add_argument('-i', '--institution', type=str, help="Query researchers by self-declared CTI VITAE main institution (ilike match).")
    
    # Pagination
    parser.add_argument('-p', '--page', type=int, default=1, help="Page number to fetch (default: 1).")
    parser.add_argument('-l', '--limit', type=int, default=10, help="Number of records to fetch per page (default: 10).")
    
    # Formatting and output
    parser.add_argument('-f', '--format', type=str, choices=['json', 'json-compact', 'csv'], default='json',
                        help="Output format to display results (default: json).")
    parser.add_argument('-out', '--output', type=str, help="Write output results directly to a local file instead of stdout.")
    
    # Configuration options
    parser.add_argument('--ssl-verify', action='store_true', default=False,
                        help="Enable SSL certificate verification (disabled by default for stability).")
    parser.add_argument('--delay', type=float, default=1.0,
                        help="Inter-request rate limit delay in seconds (default: 1.0).")
    parser.add_argument('-v', '--verbose', action='store_true', default=False,
                        help="Enable verbose informational and debugging messages.")
    
    args = parser.parse_args()
    
    # Initialize logging
    configure_logging(args.verbose)
    
    # Initialize Connector client
    connector = RenacytConnector(
        verify_ssl=args.ssl_verify,
        rate_limit_delay=args.delay,
        max_retries=3
    )
    
    async def run_query():
        results = None
        
        # 1. Query by unique DNI
        if args.dni:
            logging.info(f"Querying by DNI: {args.dni}")
            record = await connector.search_by_dni(args.dni, normalize=True)
            results = {"total": 1 if record else 0, "data": [record] if record else []}
            
        # 2. Query by unique ORCID
        elif args.orcid:
            logging.info(f"Querying by ORCID: {args.orcid}")
            record = await connector.search_by_orcid(args.orcid, normalize=True)
            results = {"total": 1 if record else 0, "data": [record] if record else []}
            
        # 3. Query by unique registration code
        elif args.code:
            logging.info(f"Querying by Code: {args.code}")
            record = await connector.search_by_codigo(args.code, normalize=True)
            results = {"total": 1 if record else 0, "data": [record] if record else []}
            
        # 4. Query by Name (returns search list)
        elif args.name:
            logging.info(f"Querying by Name: '{args.name}' (Page: {args.page}, Limit: {args.limit})")
            results = await connector.search_by_name(args.name, page=args.page, page_size=args.limit, normalize=True)
            
        # 5. Query by Last Name (returns search list)
        elif args.lastname:
            logging.info(f"Querying by Last Name: '{args.lastname}' (Page: {args.page}, Limit: {args.limit})")
            results = await connector.search_by_lastname(args.lastname, page=args.page, page_size=args.limit, normalize=True)
            
        # 6. Query by Institution (returns search list)
        elif args.institution:
            logging.info(f"Querying by Institution: '{args.institution}' (Page: {args.page}, Limit: {args.limit})")
            results = await connector.search_by_institution(args.institution, page=args.page, page_size=args.limit, normalize=True)
            
        return results

    try:
        results = asyncio.run(run_query())
        
        if results is None:
            print("Error: No search filter triggered.", file=sys.stderr)
            sys.exit(1)
            
        # Format the output data
        formatted_output = ""
        records = results.get("data", [])
        
        if args.format == 'json':
            formatted_output = json.dumps(results, indent=2, ensure_ascii=False)
        elif args.format == 'json-compact':
            formatted_output = json.dumps(results, ensure_ascii=False)
        elif args.format == 'csv':
            formatted_output = records_to_csv(records)
            
        # Output results to file or stdout
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(formatted_output)
            logging.info(f"Success! Output written to: {args.output}")
        else:
            sys.stdout.write(formatted_output + "\n")
            
    except RenacytError as re:
        print(f"RENACYT Error: {re}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unhandled Error: {e}", file=sys.stderr)
        logging.exception(e)
        sys.exit(1)

if __name__ == "__main__":
    main()
