if [[ "$ACTUAL_IP" == "$EXPECTED_IP" ]]; then
  echo "PASS: trafik tünelden cikiyor -> ${ACTUAL_IP}"
else
  die "FAIL: beklendigi gibi ${EXPECTED_IP} degil; gorulen: ${ACTUAL_IP}"
fi