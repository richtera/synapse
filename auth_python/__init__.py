from typing import Awaitable, Callable, Optional, Tuple, cast

import synapse
from synapse import module_api
import zmq
import json
import re
import logging


logger = logging.getLogger(__name__)
context = zmq.Context()

#  Socket to talk to server
# print("Connecting to hello world server…")


#  Do 10 requests, waiting each time for a response
# for request in range(10):
#     print("Sending request %s …" % request)
#     s = json.dumps({"address": "0x43a2748295d9a3D64F2c132aCc7ae3f81f7406cd",
#                     "token": "eyJzaWduYXR1cmUiOiIweDhhZDgzNzAxMGZiODhiNmRjZTJmZTMwMjZjZDgyZjQ1MjNlZWMxNGRkOWRmZDg0ODRkMjljYTQxYTExMWE1OWE0ZDgwYTE5ZjI4NmI2ODhjYjU0M2NkNDAwNGZkZmYwNjI0YjYwYTgzNmJlZTFmYzZjOTlkYjQyZWUyYTMyMzI3MWMiLCJib2R5IjoiVVJJOiBodHRwOi8vbG9jYWxob3N0OjgwODEvXG5XZWIzIFRva2VuIFZlcnNpb246IDJcbk5vbmNlOiA0ODk1MDkyOFxuSXNzdWVkIEF0OiAyMDIyLTA4LTAyVDAwOjIyOjA1LjQwOVpcbkV4cGlyYXRpb24gVGltZTogMjAyMi0wOC0wM1QwMDoyMjowNS4wMDBaIn0="
#                     })
#     socket.send(s.encode("utf-8"))

#     #  Get the reply.
#     message = socket.recv()
#     data = json.loads(message)
#     print("Received reply %s [ %s ]" % (request, json.dumps(data, indent=4)))


class Web3Provider:
    def __init__(self, config: dict, api: module_api):

        self.api = api
        self.socket = context.socket(zmq.REQ)
        self.socket.connect(config.get("socket", "tcp://localhost:5555"))

        api.register_password_auth_provider_callbacks(
            auth_checkers={
                ("web3.signature", ("password",)): self.check_signature,
            },
        )

    async def check_signature(
        self,
        username: str,
        login_type: str,
        login_dict: "synapse.module_api.JsonDict",
    ) -> Optional[
        Tuple[
            str,
            Optional[Callable[["synapse.module_api.LoginResponse"], Awaitable[None]]],
        ]
    ]:
        logger.info(
            "Got login request username=%r login_type=%r login_dict=%r",
            username,
            login_type,
            login_dict,
        )
        if login_type != "web3.signature" and login_type != 'm.login.password':
            return None

        token = login_dict.get("password")

        s = json.dumps({"address": username,
                        "token": token
                        })
        self.socket.send(s.encode("utf-8"))

        #  Get the reply.
        message = self.socket.recv()
        data = json.loads(message)

        # print("Received reply %s" % json.dumps(data, indent=4))

        if data.get("success"):
            return cast(Optional[
                Tuple[
                    str,
                    Optional[Callable[["synapse.module_api.LoginResponse"], Awaitable[None]]],
                ]
            ], (self.api.get_qualified_user_id(username), None,))
